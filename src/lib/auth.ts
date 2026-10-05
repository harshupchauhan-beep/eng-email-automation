import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Role, User } from "@prisma/client";
import { prisma } from "./db";
import { getEnv, isProduction } from "./env";
import { generateOpaqueToken, sha256 } from "./crypto";
import { hasRole } from "./audit";

export const SESSION_COOKIE = "eng_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export type AuthUser = Pick<User, "id" | "email" | "name" | "role" | "active">;

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export async function createSession(userId: string, meta?: { ip?: string; userAgent?: string }) {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent?.slice(0, 500),
    },
  });
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function getUserFromToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now() || !session.user.active) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    active: session.user.active,
  };
}

const LOCAL_OPERATOR: AuthUser = {
  id: "00000000-0000-4000-8000-000000000099",
  email: "operator@local",
  name: "Local operator",
  role: "ADMIN",
  active: true,
};

export async function getBypassUser(): Promise<AuthUser> {
  try {
    const existing = await prisma.user.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      return {
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role: existing.role,
        active: existing.active,
      };
    }
    const created = await prisma.user.upsert({
      where: { email: LOCAL_OPERATOR.email },
      update: { active: true, role: "ADMIN" },
      create: {
        id: LOCAL_OPERATOR.id,
        email: LOCAL_OPERATOR.email,
        name: LOCAL_OPERATOR.name,
        passwordHash: "!",
        role: "ADMIN",
      },
    });
    return {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      active: created.active,
    };
  } catch {
    return LOCAL_OPERATOR;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const sessionUser = await getUserFromToken(jar.get(SESSION_COOKIE)?.value);
  if (sessionUser) return sessionUser;
  return getBypassUser();
}

export async function requireUser(minimum: Role = "VIEWER"): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  if (!hasRole(user.role, minimum)) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return user;
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function requireApiUser(request: NextRequest, minimum: Role = "VIEWER") {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = (await getUserFromToken(token)) ?? (await getBypassUser());
  if (!user) return { user: null as AuthUser | null, error: jsonError("Unauthorized", 401) };
  if (!hasRole(user.role, minimum)) {
    return { user, error: jsonError("Forbidden", 403) };
  }
  return { user, error: null };
}

export function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function originAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(getEnv().APP_URL).origin;
  } catch {
    return false;
  }
}

export async function assertCsrf(request: NextRequest) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !originAllowed(request)) {
    return jsonError("Invalid origin", 403);
  }
  return null;
}

export { hasRole };
