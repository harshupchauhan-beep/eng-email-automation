import { createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export { escapeHtml } from "./html";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: string) {
  if (!email || email.length > 254) return false;
  return EMAIL_RE.test(email.trim());
}

export function jitter(baseMs: number, attempt: number) {
  const exp = baseMs * 2 ** Math.max(0, attempt - 1);
  const spread = Math.floor(Math.random() * exp * 0.3);
  return exp + spread;
}
