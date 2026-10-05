import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; baseMs?: number; label?: string } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseMs = options.baseMs ?? 200;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logger.warn(
        {
          err: error instanceof Error ? error.message : String(error),
          attempt: i + 1,
          label: options.label,
        },
        "database operation retry",
      );
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i + Math.floor(Math.random() * 50)));
    }
  }
  throw lastError;
}
