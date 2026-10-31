import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("UTC"),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  UNSUBSCRIBE_SECRET: z.string().min(16),
  WEBHOOK_SECRET: z.string().min(8).default("dev-webhook-secret"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_NAME: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["fake", "ses", "sendgrid", "mailgun", "postmark"]).default("fake"),
  EMAIL_PROVIDER_API_KEY: optionalString,
  EMAIL_FROM_ADDRESS: z.string().email().default("noreply@example.com"),
  EMAIL_FROM_NAME: z.string().default("Mail"),
  EMAIL_REPLY_TO: optionalString,
  SES_REGION: z.string().default("us-east-1"),
  SES_CONFIGURATION_SET: optionalString,
  SENDGRID_WEBHOOK_VERIFICATION_KEY: optionalString,
  MAILGUN_DOMAIN: optionalString,
  MAILGUN_WEBHOOK_SIGNING_KEY: optionalString,
  POSTMARK_SERVER_TOKEN: optionalString,
  POSTMARK_WEBHOOK_TOKEN: optionalString,
  EMAIL_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  EMAIL_RATE_LIMIT_PER_SECOND: z.coerce.number().int().positive().default(14),
  EMAIL_BATCH_SIZE: z.coerce.number().int().positive().default(500),
  EMAIL_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
  EMAIL_RETRY_BASE_MS: z.coerce.number().int().positive().default(2000),
  CAMPAIGN_CANCELLATION_WINDOW_SECONDS: z.coerce.number().int().nonnegative().default(15),
  RECONCILE_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  STUCK_PROCESSING_MS: z.coerce.number().int().positive().default(300000),
  ORG_NAME: z.string().default("Organization"),
  ORG_PHYSICAL_ADDRESS: z.string().default(""),
  ORG_SUPPORT_EMAIL: z.string().email().optional(),
  ENABLE_OPEN_TRACKING: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  ENABLE_CLICK_TRACKING: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  LOGIN_RATE_LIMIT_PER_15MIN: z.coerce.number().int().positive().default(5),
  FAKE_PROVIDER_LATENCY_MS: z.coerce.number().int().nonnegative().default(25),
  FAKE_PROVIDER_THROTTLE_RATE: z.coerce.number().min(0).max(1).default(0.02),
  FAKE_PROVIDER_TRANSIENT_RATE: z.coerce.number().min(0).max(1).default(0.03),
  FAKE_PROVIDER_PERMANENT_RATE: z.coerce.number().min(0).max(1).default(0.01),
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(3001),
  STORAGE_DRIVER: z.enum(["local", "r2"]).optional(),
  STORAGE_LOCAL_DIR: optionalString,
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET: optionalString,
  R2_ENDPOINT: optionalString,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache() {
  cached = null;
}

export function isProduction() {
  return getEnv().NODE_ENV === "production";
}
