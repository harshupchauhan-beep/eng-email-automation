import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "../env";

type UnsubscribePayload = {
  rid: string;
  exp: number;
};

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createUnsubscribeToken(recipientId: string, ttlSeconds = 60 * 60 * 24 * 180) {
  const payload: UnsubscribePayload = {
    rid: recipientId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = encode(JSON.stringify(payload));
  const sig = createHmac("sha256", getEnv().UNSUBSCRIBE_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): { recipientId: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getEnv().UNSUBSCRIBE_SECRET)
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(decode(body)) as UnsubscribePayload;
    if (!payload.rid || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { recipientId: payload.rid };
  } catch {
    return null;
  }
}

export function unsubscribeUrl(recipientId: string) {
  const token = createUnsubscribeToken(recipientId);
  return `${getEnv().APP_URL}/unsubscribe/${token}`;
}
