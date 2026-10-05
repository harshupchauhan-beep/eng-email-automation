import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { parsePage, withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { contactWhereFromFilter, type SegmentFilter } from "@/lib/campaigns/audience";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  filter: z.object({
    match: z.enum(["all", "any"]).optional(),
    tags: z.array(z.string()).optional(),
    status: z.array(z.string()).optional(),
    query: z.string().optional(),
  }),
});

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const { skip, take, page, pageSize } = parsePage(request);
    const [items, total] = await Promise.all([
      prisma.segment.findMany({ skip, take, orderBy: { createdAt: "desc" } }),
      prisma.segment.count(),
    ]);
    const withCounts = await Promise.all(
      items.map(async (segment) => {
        const count = await prisma.contact.count({
          where: contactWhereFromFilter(segment.filter as SegmentFilter),
        });
        return { ...segment, contactCount: count };
      }),
    );
    return NextResponse.json({ items: withCounts, total, page, pageSize });
  });
}

export async function POST(request: NextRequest) {
  return withApi(
    request,
    async ({ user, ip }) => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const segment = await prisma.segment.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          filter: parsed.data.filter as Prisma.InputJsonValue,
        },
      });
      await writeAuditLog({
        userId: user.id,
        action: "segment.create",
        entityType: "Segment",
        entityId: segment.id,
        ipAddress: ip,
      });
      return NextResponse.json({ segment }, { status: 201 });
    },
    { role: "OPERATOR" },
  );
}
