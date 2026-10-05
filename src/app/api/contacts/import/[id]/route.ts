import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(request, async () => {
    const job = await prisma.importJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job });
  });
}
