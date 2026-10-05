import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(
    request,
    async ({ user, ip }) => {
      const source = await prisma.template.findUnique({
        where: { id },
        include: { currentVersion: true },
      });
      if (!source?.currentVersion) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      const copy = await prisma.$transaction(async (tx) => {
        const created = await tx.template.create({
          data: { name: `${source.name} (copy)` },
        });
        const version = await tx.templateVersion.create({
          data: {
            templateId: created.id,
            version: 1,
            subject: source.currentVersion!.subject,
            preheader: source.currentVersion!.preheader,
            htmlBody: source.currentVersion!.htmlBody,
            textBody: source.currentVersion!.textBody,
            fallbacks: source.currentVersion!.fallbacks as Prisma.InputJsonValue,
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
        action: "template.duplicate",
        entityType: "Template",
        entityId: copy.id,
        ipAddress: ip,
        metadata: { sourceId: id },
      });
      return NextResponse.json({ template: copy }, { status: 201 });
    },
    { role: "OPERATOR" },
  );
}
