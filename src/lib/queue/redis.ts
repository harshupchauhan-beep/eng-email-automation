import Redis from "ioredis";
import { getEnv } from "../env";
import { logger } from "../logger";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export function getRedis() {
  if (globalForRedis.redis) return globalForRedis.redis;
  const url = getEnv().REDIS_URL;
  const redis = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 8) return null;
      return Math.min(times * 200, 5000);
    },
  });
  redis.on("error", (err) => {
    logger.warn({ err: err.message }, "redis unavailable");
  });
  globalForRedis.redis = redis;
  return redis;
}

export async function pingRedis() {
  const pong = await getRedis().ping();
  return pong === "PONG";
}
