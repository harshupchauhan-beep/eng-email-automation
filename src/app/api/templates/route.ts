import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { parsePage, withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  preheader: z.string().optional(),
  htmlBody: z.string().min(1),
  textBody: z.string().min(1),
  fallbacks: z.record(z.string(), z.string()).optional(),
});

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const { skip, take, page, pageSize } = parsePage(request);
    const [items, total] = await Promise.all([
      prisma.template.findMany({
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        include: { currentVersion: true },
      }),
      prisma.template.count(),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  });
}

export async function POST(request: NextRequest) {
  return withApi(
    request,
    async ({ user, ip }) => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const template = await prisma.$transaction(async (tx) => {
        const created = await tx.template.create({ data: { name: parsed.data.name } });
        const version = await tx.templateVersion.create({
          data: {
            templateId: created.id,
            version: 1,
            subject: parsed.data.subject,
            preheader: parsed.data.preheader,
            htmlBody: parsed.data.htmlBody,
            textBody: parsed.data.textBody,
            fallbacks: (parsed.data.fallbacks ?? {}) as Prisma.InputJsonValue,
            createdById: user.id,
          },
        });
        return tx.template.update({
          where: { id: created.id },
          data: { currentVersionId: version.id },
          include: { currentVersion: true },
        });
      });
      await writeAuditLog({
        userId: user.id,
        action: "template.create",
        entityType: "Template",
        entityId: template.id,
        ipAddress: ip,
      });
      return NextResponse.json({ template }, { status: 201 });
    },
    { role: "OPERATOR" },
  );
}
