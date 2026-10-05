process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://engmail:engmail@localhost:5432/engmail?schema=public";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.SESSION_SECRET = "test-session-secret-value";
process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
process.env.WEBHOOK_SECRET = "test-webhook-secret";
process.env.EMAIL_PROVIDER = "fake";
process.env.APP_URL = "http://localhost:3000";
