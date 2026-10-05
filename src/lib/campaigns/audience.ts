import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { normalizeEmail } from "../crypto";

export type SegmentFilter = {
  match?: "all" | "any";
  tags?: string[];
  status?: string[];
  query?: string;
};

export function contactWhereFromFilter(filter: SegmentFilter): Prisma.ContactWhereInput {
  const parts: Prisma.ContactWhereInput[] = [{ archivedAt: null }];
  if (filter.status?.length) {
    parts.push({ status: { in: filter.status as never } });
  }
  if (filter.tags?.length) {
    parts.push({
      tags: { some: { tag: { name: { in: filter.tags } } } },
    });
  }
  if (filter.query) {
    const q = filter.query.trim();
    parts.push({
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: parts };
}

export type AudienceConfig = {
  tagIds?: string[];
  tagNames?: string[];
  contactIds?: string[];
  emails?: string[];
  segmentId?: string;
};

function tagWhere(config: AudienceConfig): Prisma.ContactWhereInput {
  const names = config.tagNames ?? [];
  const ids = config.tagIds ?? [];
  return {
    tags: {
      some: {
        OR: [
          ids.length ? { tagId: { in: ids } } : undefined,
          names.length ? { tag: { name: { in: names } } } : undefined,
        ].filter(Boolean) as Prisma.ContactTagWhereInput[],
      },
    },
  };
}

function manualWhere(config: AudienceConfig): Prisma.ContactWhereInput {
  const emails = (config.emails ?? []).map(normalizeEmail);
  const ids = config.contactIds ?? [];
  return {
    OR: [
      ids.length ? { id: { in: ids } } : undefined,
      emails.length ? { emailNormalized: { in: emails } } : undefined,
    ].filter(Boolean) as Prisma.ContactWhereInput[],
  };
}

export async function selectedAudienceWhere(input: {
  audienceType: "ALL" | "TAGS" | "SEGMENT" | "MANUAL";
  audienceConfig: AudienceConfig;
  segmentFilter?: SegmentFilter | null;
}): Promise<Prisma.ContactWhereInput> {
  const base: Prisma.ContactWhereInput = { archivedAt: null };
  if (input.audienceType === "ALL") return base;
  if (input.audienceType === "TAGS") return { AND: [base, tagWhere(input.audienceConfig)] };
  if (input.audienceType === "SEGMENT") {
    return { AND: [base, contactWhereFromFilter(input.segmentFilter ?? {})] };
  }
  return { AND: [base, manualWhere(input.audienceConfig)] };
}

export async function eligibleAudienceWhere(input: {
  audienceType: "ALL" | "TAGS" | "SEGMENT" | "MANUAL";
  audienceConfig: AudienceConfig;
  segmentFilter?: SegmentFilter | null;
}): Promise<Prisma.ContactWhereInput> {
  const selected = await selectedAudienceWhere(input);
  const suppressions = await suppressedEmails();
  return {
    AND: [
      selected,
      { status: "ACTIVE" },
      suppressions.length ? { emailNormalized: { notIn: suppressions } } : {},
    ],
  };
}

async function suppressedEmails() {
  const rows = await prisma.suppression.findMany({ select: { emailNormalized: true } });
  return rows.map((r) => r.emailNormalized);
}

export async function estimateAudience(input: {
  audienceType: "ALL" | "TAGS" | "SEGMENT" | "MANUAL";
  audienceConfig: AudienceConfig;
  segmentId?: string | null;
}) {
  let segmentFilter: SegmentFilter | null = null;
  if (input.audienceType === "SEGMENT" && (input.segmentId || input.audienceConfig.segmentId)) {
    const segment = await prisma.segment.findUnique({
      where: { id: input.segmentId ?? input.audienceConfig.segmentId! },
    });
    segmentFilter = (segment?.filter as SegmentFilter) ?? {};
  }

  const selectedWhere = await selectedAudienceWhere({ ...input, segmentFilter });
  const suppressions = await suppressedEmails();
  const [totalSelected, suppressedByList, ineligibleStatus, estimatedEligible] = await Promise.all([
    prisma.contact.count({ where: selectedWhere }),
    prisma.contact.count({
      where: { AND: [selectedWhere, { emailNormalized: { in: suppressions } }] },
    }),
    prisma.contact.count({
      where: {
        AND: [
          selectedWhere,
          { status: { not: "ACTIVE" } },
          suppressions.length ? { emailNormalized: { notIn: suppressions } } : {},
        ],
      },
    }),
    prisma.contact.count({
      where: {
        AND: [
          selectedWhere,
          { status: "ACTIVE" },
          suppressions.length ? { emailNormalized: { notIn: suppressions } } : {},
        ],
      },
    }),
  ]);

  return {
    totalSelected,
    suppressed: suppressedByList + ineligibleStatus,
    invalid: 0,
    estimatedEligible,
  };
}
