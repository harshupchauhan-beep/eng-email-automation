import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  SESSION_COOKIE,
  cookieOptions,
  createSession,
  clientIp,
} from "@/lib/auth";
import { consumeLimit, getLoginLimiter } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/crypto";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limiter = await getLoginLimiter();
  const allowed = await consumeLimit(limiter, `${ip}:login`);
  if (!allowed.ok) {
    return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
  }

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const email = body.data.email.trim().toLowerCase();
  const limitedEmail = await consumeLimit(limiter, `${email}:login`);
  if (!limitedEmail.ok) {
    return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user?.active ? await verifyPassword(body.data.password, user.passwordHash) : false;
  await prisma.loginAttempt.create({
    data: { email, ipAddress: ip, success: ok },
  });

  if (!ok || !user) {
    await writeAuditLog({
      action: "auth.login_failed",
      entityType: "User",
      ipAddress: ip,
      metadata: { email },
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = await createSession(user.id, {
    ip,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await writeAuditLog({
    userId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    ipAddress: ip,
  });

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE, session.token, cookieOptions());
  return response;
}
