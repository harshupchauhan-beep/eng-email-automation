import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { parsePage, withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(12),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]),
});

export async function GET(request: NextRequest) {
  return withApi(
    request,
    async () => {
      const { skip, take, page, pageSize } = parsePage(request);
      const [items, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            active: true,
            createdAt: true,
            lastLoginAt: true,
          },
        }),
        prisma.user.count(),
      ]);
      return NextResponse.json({ items, total, page, pageSize });
    },
    { role: "ADMIN" },
  );
}

export async function POST(request: NextRequest) {
  return withApi(
    request,
    async ({ user, ip }) => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid user payload" }, { status: 400 });
      }
      const created = await prisma.user.create({
        data: {
          email: parsed.data.email.toLowerCase(),
          name: parsed.data.name,
          passwordHash: await hashPassword(parsed.data.password),
          role: parsed.data.role as Role,
        },
        select: { id: true, email: true, name: true, role: true },
      });
      await writeAuditLog({
        userId: user.id,
        action: "user.create",
        entityType: "User",
        entityId: created.id,
        ipAddress: ip,
      });
      return NextResponse.json({ user: created }, { status: 201 });
    },
    { role: "ADMIN" },
  );
}
