import { applyNormalizedEvent } from "../../lib/email/events";
import { parseWebhookEvents } from "../../lib/email/webhooks";
import type { WebhookJobData } from "../../lib/queue/types";
import { childLogger } from "../../lib/logger";

const log = childLogger({ module: "webhook-worker" });

export async function processWebhook(data: WebhookJobData) {
  const events = parseWebhookEvents(data.provider, data.payload);
  for (const event of events) {
    if (!event.email) continue;
    const result = await applyNormalizedEvent(event);
    log.info(
      {
        provider: data.provider,
        type: event.type,
        providerEventId: event.providerEventId,
        duplicate: result.duplicate,
      },
      "processed provider event",
    );
  }
}
