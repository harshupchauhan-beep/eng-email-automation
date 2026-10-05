import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { upsertTags } from "@/lib/contacts/service";
import { Prisma } from "@prisma/client";

const patchSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(request, async () => {
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ contact });
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
      const parsed = patchSchema.safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const tags = parsed.data.tags ? await upsertTags(parsed.data.tags) : null;
      const contact = await prisma.contact.update({
        where: { id },
        data: {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          company: parsed.data.company,
          phone: parsed.data.phone,
          customFields: parsed.data.customFields as Prisma.InputJsonValue | undefined,
          ...(tags
            ? {
                tags: {
                  deleteMany: {},
                  create: tags.map((t) => ({ tagId: t.id })),
                },
              }
            : {}),
        },
        include: { tags: { include: { tag: true } } },
      });
      await writeAuditLog({
        userId: user.id,
        action: "contact.update",
        entityType: "Contact",
        entityId: id,
        ipAddress: ip,
      });
      return NextResponse.json({ contact });
    },
    { role: "OPERATOR" },
  );
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(
    request,
    async ({ user, ip }) => {
      await prisma.contact.update({
        where: { id },
        data: { archivedAt: new Date(), status: "ARCHIVED" },
      });
      await writeAuditLog({
        userId: user.id,
        action: "contact.delete",
        entityType: "Contact",
        entityId: id,
        ipAddress: ip,
      });
      return NextResponse.json({ ok: true });
    },
    { role: "OPERATOR" },
  );
}
