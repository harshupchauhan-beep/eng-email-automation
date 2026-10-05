import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1),
  preheader: z.string().optional(),
  htmlBody: z.string().min(1),
  textBody: z.string().min(1),
  fallbacks: z.record(z.string(), z.string()).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(request, async () => {
    const template = await prisma.template.findUnique({
      where: { id },
      include: { currentVersion: true, versions: { orderBy: { version: "desc" } } },
    });
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ template });
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(
    request,
    async ({ user, ip }) => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const latest = await prisma.templateVersion.findFirst({
        where: { templateId: id },
        orderBy: { version: "desc" },
      });
      const version = await prisma.templateVersion.create({
        data: {
          templateId: id,
          version: (latest?.version ?? 0) + 1,
          subject: parsed.data.subject,
          preheader: parsed.data.preheader,
          htmlBody: parsed.data.htmlBody,
          textBody: parsed.data.textBody,
          fallbacks: (parsed.data.fallbacks ?? {}) as Prisma.InputJsonValue,
          createdById: user.id,
        },
      });
      const template = await prisma.template.update({
        where: { id },
        data: {
          name: parsed.data.name,
          currentVersionId: version.id,
        },
        include: { currentVersion: true, versions: { orderBy: { version: "desc" } } },
      });
      await writeAuditLog({
        userId: user.id,
        action: "template.update",
        entityType: "Template",
        entityId: id,
        ipAddress: ip,
        metadata: { version: version.version },
      });
      return NextResponse.json({ template });
    },
    { role: "OPERATOR" },
  );
}
