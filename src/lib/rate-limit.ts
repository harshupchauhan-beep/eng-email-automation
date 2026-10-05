import { RateLimiterMemory } from "rate-limiter-flexible";
import { getEnv } from "./env";

let apiLimiter: RateLimiterMemory | null = null;
let loginLimiter: RateLimiterMemory | null = null;

export async function getApiLimiter() {
  if (apiLimiter) return apiLimiter;
  const env = getEnv();
  apiLimiter = new RateLimiterMemory({
    points: env.API_RATE_LIMIT_PER_MINUTE,
    duration: 60,
  });
  return apiLimiter;
}

export async function getLoginLimiter() {
  if (loginLimiter) return loginLimiter;
  const env = getEnv();
  loginLimiter = new RateLimiterMemory({
    points: env.LOGIN_RATE_LIMIT_PER_15MIN,
    duration: 15 * 60,
  });
  return loginLimiter;
}

export async function consumeLimit(limiter: RateLimiterMemory, key: string) {
  try {
    await limiter.consume(key);
    return { ok: true as const };
  } catch (error) {
    if (error && typeof error === "object" && "msBeforeNext" in error) {
      return { ok: false as const };
    }
    return { ok: true as const };
  }
}
