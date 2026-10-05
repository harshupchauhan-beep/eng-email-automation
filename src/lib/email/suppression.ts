import { ContactStatus, Prisma, SuppressionReason } from "@prisma/client";
import { prisma } from "../db";
import { normalizeEmail } from "../crypto";

const STATUS_FOR_REASON: Record<SuppressionReason, ContactStatus> = {
  UNSUBSCRIBE: "UNSUBSCRIBED",
  HARD_BOUNCE: "BOUNCED",
  COMPLAINT: "COMPLAINED",
  MANUAL: "SUPPRESSED",
};

export async function isSuppressed(email: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const emailNormalized = normalizeEmail(email);
  const row = await tx.suppression.findUnique({
    where: { emailNormalized },
    select: { id: true },
  });
  return Boolean(row);
}

export async function suppressAddress(input: {
  email: string;
  reason: SuppressionReason;
  source?: string;
  notes?: string;
  createdById?: string;
  tx?: Prisma.TransactionClient | typeof prisma;
}) {
  const db = input.tx ?? prisma;
  const emailNormalized = normalizeEmail(input.email);
  await db.suppression.upsert({
    where: { emailNormalized },
    create: {
      email: input.email.trim(),
      emailNormalized,
      reason: input.reason,
      source: input.source,
      notes: input.notes,
      createdById: input.createdById,
    },
    update: {
      reason: input.reason,
      source: input.source ?? undefined,
      notes: input.notes ?? undefined,
    },
  });
  await db.contact.updateMany({
    where: { emailNormalized, status: "ACTIVE" },
    data: { status: STATUS_FOR_REASON[input.reason] },
  });
}

export async function suppressedSet(emails: string[]) {
  const normalized = [...new Set(emails.map(normalizeEmail))];
  if (normalized.length === 0) return new Set<string>();
  const rows = await prisma.suppression.findMany({
    where: { emailNormalized: { in: normalized } },
    select: { emailNormalized: true },
  });
  return new Set(rows.map((r) => r.emailNormalized));
}
