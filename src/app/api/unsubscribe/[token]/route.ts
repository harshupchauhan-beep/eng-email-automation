import { NextRequest, NextResponse } from "next/server";
import { processUnsubscribeToken } from "@/lib/email/process-unsubscribe";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const result = await processUnsubscribeToken(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
