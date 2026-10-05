import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContactStatus, Prisma } from "@prisma/client";
import { parsePage, withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createContact } from "@/lib/contacts/service";
import { writeAuditLog } from "@/lib/audit";

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const { skip, take, page, pageSize } = parsePage(request);
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const status = request.nextUrl.searchParams.get("status") as ContactStatus | null;
    const tag = request.nextUrl.searchParams.get("tag");
    const where: Prisma.ContactWhereInput = {
      archivedAt: request.nextUrl.searchParams.get("archived") === "true" ? { not: null } : null,
    };
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
      ];
    }
    if (tag) where.tags = { some: { tag: { name: tag } } };
    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { tags: { include: { tag: true } } },
      }),
      prisma.contact.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  });
}

export async function POST(request: NextRequest) {
  return withApi(
    request,
    async ({ user, ip }) => {
      const parsed = createSchema.safeParse(await request.json());
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const contact = await createContact(parsed.data);
      await writeAuditLog({
        userId: user.id,
        action: "contact.create",
        entityType: "Contact",
        entityId: contact.id,
        ipAddress: ip,
      });
      return NextResponse.json({ contact }, { status: 201 });
    },
    { role: "OPERATOR" },
  );
}

