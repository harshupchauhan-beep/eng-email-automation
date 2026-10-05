import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parsePage, withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { suppressAddress } from "@/lib/email/suppression";
import { writeAuditLog } from "@/lib/audit";
import { isValidEmail } from "@/lib/crypto";

const schema = z.object({
  email: z.string().email(),
  reason: z.enum(["UNSUBSCRIBE", "HARD_BOUNCE", "COMPLAINT", "MANUAL"]).default("MANUAL"),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const { skip, take, page, pageSize } = parsePage(request);
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const where = q ? { email: { contains: q, mode: "insensitive" as const } } : {};
    const [items, total] = await Promise.all([
      prisma.suppression.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.suppression.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  });
}

export async function POST(request: NextRequest) {
  return withApi(
    request,
    async ({ user, ip }) => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success || !isValidEmail(parsed.data.email)) {
        return NextResponse.json({ error: "Valid email required" }, { status: 400 });
      }
      await suppressAddress({
        email: parsed.data.email,
        reason: parsed.data.reason,
        source: "manual",
        notes: parsed.data.notes,
        createdById: user.id,
      });
      await writeAuditLog({
        userId: user.id,
        action: "suppression.create",
        entityType: "Suppression",
        ipAddress: ip,
        metadata: { email: parsed.data.email, reason: parsed.data.reason },
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    },
    { role: "OPERATOR" },
  );
}
