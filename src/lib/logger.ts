import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: process.env.WORKER_ROLE === "worker" ? "worker" : "web" },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "sessionToken",
      "authorization",
      "apiKey",
      "EMAIL_PROVIDER_API_KEY",
      "SESSION_SECRET",
      "UNSUBSCRIBE_SECRET",
      "WEBHOOK_SECRET",
      "cookie",
      "*.password",
      "*.apiKey",
      "*.token",
    ],
    censor: "[redacted]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
