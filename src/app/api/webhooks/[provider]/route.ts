import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/email/webhooks";
import { enqueueWebhook } from "@/lib/queue/queues";
import { logger } from "@/lib/logger";
import { generateOpaqueToken } from "@/lib/crypto";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());
  const verified = await verifyWebhookSignature(provider, rawBody, headers);
  if (!verified) {
    logger.warn({ provider }, "webhook signature rejected");
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
  }
  let payload: unknown = rawBody;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = Object.fromEntries(new URLSearchParams(rawBody));
  }
  const eventId =
    (payload as { sg_event_id?: string; MessageID?: string; id?: string })?.sg_event_id ??
    (payload as { MessageID?: string }).MessageID ??
    generateOpaqueToken(12);
  await enqueueWebhook({ provider, payload, headers }, String(eventId));
  return NextResponse.json({ ok: true });
}
