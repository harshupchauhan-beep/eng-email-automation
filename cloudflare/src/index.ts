import { DurableObject } from "cloudflare:workers";

interface Env {
  APP: DurableObjectNamespace<AppContainer>;
  SEND_WORKER: DurableObjectNamespace<SendWorkerContainer>;
  [key: string]: unknown;
}

const APP_PORT = 3000;
const WORKER_PORT = 3001;
const APP_IDLE_MS = 30 * 60 * 1000;
const WORKER_IDLE_MS = 2 * 60 * 60 * 1000;

const CONTAINER_ENV_KEYS = [
  "NODE_ENV",
  "APP_URL",
  "APP_TIMEZONE",
  "LOG_LEVEL",
  "DATABASE_URL",
  "REDIS_URL",
  "SESSION_SECRET",
  "UNSUBSCRIBE_SECRET",
  "WEBHOOK_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "ADMIN_NAME",
  "EMAIL_PROVIDER",
  "EMAIL_PROVIDER_API_KEY",
  "EMAIL_FROM_ADDRESS",
  "EMAIL_FROM_NAME",
  "EMAIL_REPLY_TO",
  "SES_REGION",
  "SES_CONFIGURATION_SET",
  "SENDGRID_WEBHOOK_VERIFICATION_KEY",
  "MAILGUN_DOMAIN",
  "MAILGUN_WEBHOOK_SIGNING_KEY",
  "POSTMARK_SERVER_TOKEN",
  "POSTMARK_WEBHOOK_TOKEN",
  "EMAIL_WORKER_CONCURRENCY",
  "EMAIL_RATE_LIMIT_PER_SECOND",
  "EMAIL_BATCH_SIZE",
  "EMAIL_MAX_RETRIES",
  "EMAIL_RETRY_BASE_MS",
  "CAMPAIGN_CANCELLATION_WINDOW_SECONDS",
  "RECONCILE_INTERVAL_MS",
  "STUCK_PROCESSING_MS",
  "ORG_NAME",
  "ORG_PHYSICAL_ADDRESS",
  "ORG_SUPPORT_EMAIL",
  "ENABLE_OPEN_TRACKING",
  "ENABLE_CLICK_TRACKING",
  "API_RATE_LIMIT_PER_MINUTE",
  "LOGIN_RATE_LIMIT_PER_15MIN",
  "WORKER_HEALTH_PORT",
  "STORAGE_DRIVER",
  "STORAGE_LOCAL_DIR",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
] as const;

function containerEnv(env: Env): Record<string, string> {
  const out: Record<string, string> = {
    NODE_ENV: "production",
    STORAGE_DRIVER: "r2",
    WORKER_HEALTH_PORT: String(WORKER_PORT),
  };
  for (const key of CONTAINER_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) out[key] = value;
  }
  return out;
}

function rewriteForContainer(request: Request) {
  const url = new URL(request.url);
  url.protocol = "http:";
  url.host = "container";
  const forwarded = new Request(url, request);
  forwarded.headers.delete("host");
  return forwarded;
}

async function waitForHealth(container: NonNullable<DurableObjectState["container"]>, port: number, path: string) {
  const tcp = container.getTcpPort(port);
  let lastError: unknown;
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const response = await tcp.fetch(`http://container${path}`, {
        signal: AbortSignal.timeout(2000),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`health ${response.status}`);
      return;
    } catch (error) {
      lastError = error;
      await scheduler.wait(400);
    }
  }
  throw new Error(`Container did not become ready on port ${port}`, { cause: lastError });
}

class ProxiedContainer extends DurableObject<Env> {
  private starting: Promise<void> | undefined;

  constructor(
    ctx: DurableObjectState,
    env: Env,
    private readonly options: { port: number; healthPath: string; instance: string; idleMs: number },
  ) {
    super(ctx, env);
    const container = ctx.container;
    if (container?.running) {
      void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(this.options.idleMs));
    }
  }

  async fetch(request: Request) {
    await this.ensureRunning();
    return this.ctx.container!.getTcpPort(this.options.port).fetch(rewriteForContainer(request));
  }

  async wake() {
    await this.ensureRunning();
    return { ok: true };
  }

  private ensureRunning() {
    this.starting ??= this.startAndWait().finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }

  private async startAndWait() {
    const container = this.ctx.container;
    if (!container) throw new Error("No container configured for this Durable Object");
    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: this.options.instance,
        enableInternet: true,
        env: containerEnv(this.env),
      });
    }
    await container.setInactivityTimeout(this.options.idleMs);
    await waitForHealth(container, this.options.port, this.options.healthPath);
  }
}

export class AppContainer extends ProxiedContainer {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, {
      port: APP_PORT,
      healthPath: "/api/health",
      instance: "standard-1",
      idleMs: APP_IDLE_MS,
    });
  }
}

export class SendWorkerContainer extends ProxiedContainer {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, {
      port: WORKER_PORT,
      healthPath: "/health",
      instance: "basic",
      idleMs: WORKER_IDLE_MS,
    });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return env.APP.getByName("primary").fetch(request);
  },
  async scheduled(_controller: ScheduledController, env: Env) {
    await env.SEND_WORKER.getByName("primary").wake();
  },
} satisfies ExportedHandler<Env>;
