import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { assertCsrf, clientIp, requireApiUser, AuthUser } from "./auth";
import { consumeLimit, getApiLimiter } from "./rate-limit";
import { logger } from "./logger";

export async function withApi(
  request: NextRequest,
  handler: (ctx: { user: AuthUser; ip: string }) => Promise<NextResponse>,
  options: { role?: Role; skipCsrf?: boolean } = {},
) {
  const ip = clientIp(request);
  const limiter = await getApiLimiter();
  const limited = await consumeLimit(limiter, `${ip}:${request.nextUrl.pathname}`);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!options.skipCsrf) {
    const csrf = await assertCsrf(request);
    if (csrf) return csrf;
  }
  const { user, error } = await requireApiUser(request, options.role ?? "VIEWER");
  if (error || !user) return error!;
  try {
    return await handler({ user, ip });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    const status = (err as { status?: number }).status ?? 400;
    logger.error({ err: message, path: request.nextUrl.pathname }, "api error");
    return NextResponse.json({ error: message }, { status });
  }
}

export function parsePage(request: NextRequest) {
  const url = request.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
