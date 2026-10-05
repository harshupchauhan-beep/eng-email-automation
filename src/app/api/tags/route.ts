import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ name: z.string().min(1).max(64) });

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { contacts: true } } },
    });
    return NextResponse.json({ tags });
  });
}

export async function POST(request: NextRequest) {
  return withApi(
    request,
    async ({ user, ip }) => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
      const tag = await prisma.tag.upsert({
        where: { name: parsed.data.name.trim() },
        update: {},
        create: { name: parsed.data.name.trim() },
      });
      await writeAuditLog({
        userId: user.id,
        action: "tag.create",
        entityType: "Tag",
        entityId: tag.id,
        ipAddress: ip,
      });
      return NextResponse.json({ tag }, { status: 201 });
    },
    { role: "OPERATOR" },
  );
}
