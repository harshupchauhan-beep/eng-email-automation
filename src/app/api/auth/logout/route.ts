import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, destroySession, clientIp, getUserFromToken } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getUserFromToken(token);
  if (token) await destroySession(token);
  if (user) {
    await writeAuditLog({
      userId: user.id,
      action: "auth.logout",
      entityType: "User",
      entityId: user.id,
      ipAddress: clientIp(request),
    });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
