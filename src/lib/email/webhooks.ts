import { createHmac, createVerify } from "node:crypto";
import { getEnv } from "../env";
import { safeEqual } from "../crypto";
import type { NormalizedEvent } from "./events";

export async function verifyWebhookSignature(
  provider: string,
  rawBody: string,
  headers: Record<string, string>,
): Promise<boolean> {
  const env = getEnv();
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );

  if (provider === "fake") {
    const provided = lower["x-webhook-secret"] ?? "";
    return safeEqual(provided, env.WEBHOOK_SECRET);
  }

  if (provider === "sendgrid") {
    const signature = lower["x-twilio-email-event-webhook-signature"];
    const timestamp = lower["x-twilio-email-event-webhook-timestamp"];
    const key = env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
    if (!signature || !timestamp || !key) return false;
    try {
      const verifier = createVerify("sha256");
      verifier.update(timestamp + rawBody);
      verifier.end();
      const publicKey = key.includes("BEGIN PUBLIC KEY")
        ? key
        : `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
      return verifier.verify(publicKey, signature, "base64");
    } catch {
      return false;
    }
  }

  if (provider === "mailgun") {
    let timestamp = lower["timestamp"];
    let token = lower["token"];
    let signature = lower["signature"];
    try {
      const parsed = JSON.parse(rawBody) as {
        signature?: { timestamp?: string; token?: string; signature?: string };
      };
      timestamp = timestamp ?? parsed.signature?.timestamp ?? "";
      token = token ?? parsed.signature?.token ?? "";
      signature = signature ?? parsed.signature?.signature ?? "";
    } catch {
      /* form body handled via headers */
    }
    const signingKey = env.MAILGUN_WEBHOOK_SIGNING_KEY ?? env.WEBHOOK_SECRET;
    if (!timestamp || !token || !signature) return false;
    const encoded = createHmac("sha256", signingKey).update(timestamp + token).digest("hex");
    return safeEqual(encoded, signature);
  }

  if (provider === "postmark") {
    const token = env.POSTMARK_WEBHOOK_TOKEN ?? env.WEBHOOK_SECRET;
    const provided =
      lower["x-postmark-webhook-token"] ??
      lower["authorization"]?.replace(/^Bearer\s+/i, "") ??
      "";
    return Boolean(token && provided && safeEqual(provided, token));
  }

  if (provider === "ses") {
    try {
      const body = JSON.parse(rawBody) as { Type?: string; Signature?: string; SigningCertURL?: string };
      if (!body.Signature || !body.SigningCertURL) return false;
      const url = new URL(body.SigningCertURL);
      return url.hostname.endsWith(".amazonaws.com");
    } catch {
      return false;
    }
  }

  return false;
}

export function parseWebhookEvents(provider: string, payload: unknown): NormalizedEvent[] {
  if (provider === "sendgrid" && Array.isArray(payload)) {
    return payload.map((item, index) => {
      const row = item as Record<string, unknown>;
      const event = String(row.event ?? "delivered");
      return {
        provider,
        providerEventId: String(row.sg_event_id ?? row.sg_message_id ?? `${row.email}-${event}-${index}`),
        type: mapType(event),
        email: String(row.email ?? ""),
        providerMessageId: row.sg_message_id ? String(row.sg_message_id) : undefined,
        campaignRecipientId: row.campaignRecipientId
          ? String(row.campaignRecipientId)
          : undefined,
        bounceType: event === "bounce" ? "hard" : event === "dropped" ? "hard" : undefined,
        payload: row,
      };
    });
  }

  if (provider === "mailgun") {
    const row = unwrapMailgun(payload);
    const event = String(row.event ?? row["event-data"] ?? "delivered");
    return [
      {
        provider,
        providerEventId: String(row.id ?? row["Message-Id"] ?? `${row.recipient}-${event}`),
        type: mapType(event),
        email: String(row.recipient ?? row["event-data.recipient"] ?? ""),
        providerMessageId: row["Message-Id"] ? String(row["Message-Id"]) : undefined,
        payload: row,
      },
    ];
  }

  if (provider === "postmark") {
    const row = payload as Record<string, unknown>;
    const recordType = String(row.RecordType ?? row.Type ?? "Delivery");
    return [
      {
        provider,
        providerEventId: String(row.MessageID ?? row.ID ?? `${row.Recipient}-${recordType}`),
        type: mapType(recordType),
        email: String(row.Recipient ?? row.Email ?? ""),
        providerMessageId: row.MessageID ? String(row.MessageID) : undefined,
        bounceType: recordType === "Bounce" && String(row.Type) === "HardBounce" ? "hard" : "soft",
        payload: row,
      },
    ];
  }

  if (provider === "ses") {
    return parseSes(payload);
  }

  if (provider === "fake") {
    const row = payload as Record<string, unknown>;
    return [
      {
        provider,
        providerEventId: String(row.providerEventId ?? row.id ?? crypto.randomUUID()),
        type: mapType(String(row.type ?? "delivered")),
        email: String(row.email ?? ""),
        providerMessageId: row.providerMessageId ? String(row.providerMessageId) : undefined,
        campaignRecipientId: row.campaignRecipientId
          ? String(row.campaignRecipientId)
          : undefined,
        bounceType: row.bounceType === "soft" ? "soft" : "hard",
        payload: row,
      },
    ];
  }

  return [];
}

function mapType(event: string): NormalizedEvent["type"] {
  const e = event.toLowerCase();
  if (e.includes("deliver")) return "delivered";
  if (e.includes("defer") || e.includes("dropped")) return e.includes("dropped") ? "rejected" : "deferred";
  if (e.includes("bounce")) return "bounced";
  if (e.includes("complain") || e.includes("spam")) return "complained";
  if (e.includes("unsub")) return "unsubscribed";
  if (e.includes("open")) return "opened";
  if (e.includes("click")) return "clicked";
  if (e.includes("reject")) return "rejected";
  return "delivered";
}

function unwrapMailgun(payload: unknown) {
  if (payload && typeof payload === "object" && "event-data" in payload) {
    return (payload as { "event-data": Record<string, unknown> })["event-data"];
  }
  return (payload ?? {}) as Record<string, unknown>;
}

function parseSes(payload: unknown): NormalizedEvent[] {
  const envelope = payload as {
    Type?: string;
    Message?: string;
    SubscribeURL?: string;
  };
  if (envelope.Type === "SubscriptionConfirmation") {
    return [];
  }
  const inner = envelope.Message ? (JSON.parse(envelope.Message) as Record<string, unknown>) : (payload as Record<string, unknown>);
  const notificationType = String(inner.notificationType ?? inner.eventType ?? "");
  const mail = (inner.mail ?? {}) as { messageId?: string; destination?: string[] };
  const email = mail.destination?.[0] ?? "";
  const bounce = inner.bounce as { bounceType?: string; bouncedRecipients?: { emailAddress?: string }[] } | undefined;
  const complaint = inner.complaint as { complainedRecipients?: { emailAddress?: string }[] } | undefined;
  const type = mapType(notificationType);
  const bounceType = bounce?.bounceType === "Permanent" ? "hard" : "soft";
  const addresses =
    bounce?.bouncedRecipients?.map((r) => r.emailAddress).filter(Boolean) ??
    complaint?.complainedRecipients?.map((r) => r.emailAddress).filter(Boolean) ??
    [email];
  return addresses.filter(Boolean).map((addr, i) => ({
    provider: "ses",
    providerEventId: `${mail.messageId ?? "ses"}:${notificationType}:${addr}:${i}`,
    type,
    email: String(addr),
    providerMessageId: mail.messageId,
    bounceType,
    payload: inner,
  }));
}
