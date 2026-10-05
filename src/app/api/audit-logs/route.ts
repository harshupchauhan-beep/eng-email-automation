import { NextRequest, NextResponse } from "next/server";
import { parsePage, withApi } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const { skip, take, page, pageSize } = parsePage(request);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true, name: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  });
}
