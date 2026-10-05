import { stringify } from "csv-stringify/sync";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const ids = request.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean);
    const where: Prisma.ContactWhereInput = { archivedAt: null };
    if (ids?.length) where.id = { in: ids };
    const contacts = await prisma.contact.findMany({
      where,
      take: 50000,
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: "asc" },
    });
    const csv = stringify(
      contacts.map((c) => ({
        email: c.email,
        firstName: c.firstName ?? "",
        lastName: c.lastName ?? "",
        company: c.company ?? "",
        phone: c.phone ?? "",
        status: c.status,
        tags: c.tags.map((t) => t.tag.name).join("|"),
        source: c.source ?? "",
      })),
      { header: true },
    );
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="contacts.csv"',
      },
    });
  });
}
