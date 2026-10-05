import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db";
import { pingRedis } from "@/lib/queue/redis";
import { prisma } from "@/lib/db";

export async function GET() {
  const checks: Record<string, boolean | string> = {};
  try {
    await pingDatabase();
    checks.postgres = true;
  } catch (error) {
    checks.postgres = false;
    checks.postgresError = String(error);
  }
  try {
    checks.redis = await pingRedis();
  } catch {
    checks.redis = false;
  }
  try {
    const beat = await prisma.workerHeartbeat.findUnique({ where: { id: "primary" } });
    checks.worker =
      Boolean(beat) && Date.now() - beat!.lastSeenAt.getTime() < 60_000;
  } catch {
    checks.worker = false;
  }
  const ok = checks.postgres === true && checks.redis === true;
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
