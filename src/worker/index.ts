import "dotenv/config";
import { Worker, Job } from "bullmq";
import { getEnv } from "../lib/env";
import { getRedis } from "../lib/queue/redis";
import { QUEUE_NAMES } from "../lib/queue/types";
import { getReconcileQueue } from "../lib/queue/queues";
import { logger } from "../lib/logger";
import { processMaterialize } from "./processors/materialize";
import { processSend, RetryableSendError } from "./processors/send";
import { processImport } from "./processors/import";
import { processWebhook } from "./processors/webhook";
import { processScheduled } from "./processors/scheduled";
import { processReconcile } from "./processors/reconcile";
import { startWorkerHealthServer } from "./health";
import type {
  ImportJobData,
  MaterializeJobData,
  ReconcileJobData,
  ScheduledJobData,
  SendJobData,
  WebhookJobData,
} from "../lib/queue/types";

process.env.WORKER_ROLE = "worker";

const env = getEnv();
const connection = getRedis();
const workers: Worker[] = [];

function wrap<T>(name: string, fn: (job: Job<T>) => Promise<void>) {
  return async (job: Job<T>) => {
    const log = logger.child({
      queue: name,
      jobId: job.id,
      campaignId: (job.data as { campaignId?: string }).campaignId,
      campaignSendId: (job.data as { campaignSendId?: string }).campaignSendId,
      campaignRecipientId: (job.data as { campaignRecipientId?: string }).campaignRecipientId,
    });
    log.info("job started");
    try {
      await fn(job);
      log.info("job completed");
    } catch (error) {
      log.error({ err: error instanceof Error ? error.message : String(error) }, "job failed");
      throw error;
    }
  };
}

workers.push(
  new Worker<MaterializeJobData>(
    QUEUE_NAMES.materialize,
    wrap("materialize", (job) => processMaterialize(job.data)),
    { connection, concurrency: 2 },
  ),
);

workers.push(
  new Worker<SendJobData>(
    QUEUE_NAMES.send,
    wrap("send", async (job) => {
      try {
        await processSend(job.data);
      } catch (error) {
        if (error instanceof RetryableSendError) throw error;
        throw error;
      }
    }),
    {
      connection,
      concurrency: env.EMAIL_WORKER_CONCURRENCY,
      limiter: {
        max: env.EMAIL_RATE_LIMIT_PER_SECOND,
        duration: 1000,
      },
    },
  ),
);

workers.push(
  new Worker<ImportJobData>(
    QUEUE_NAMES.csvImport,
    wrap("import", (job) => processImport(job.data)),
    { connection, concurrency: 1 },
  ),
);

workers.push(
  new Worker<WebhookJobData>(
    QUEUE_NAMES.webhook,
    wrap("webhook", (job) => processWebhook(job.data)),
    { connection, concurrency: 5 },
  ),
);

workers.push(
  new Worker<ScheduledJobData>(
    QUEUE_NAMES.scheduled,
    wrap("scheduled", (job) => processScheduled(job.data)),
    { connection, concurrency: 1 },
  ),
);

workers.push(
  new Worker<ReconcileJobData>(
    QUEUE_NAMES.reconcile,
    wrap("reconcile", () => processReconcile()),
    { connection, concurrency: 1 },
  ),
);

async function setupRepeatable() {
  const queue = getReconcileQueue();
  await queue.upsertJobScheduler(
    "reconcile-repeat",
    { every: env.RECONCILE_INTERVAL_MS },
    {
      name: "reconcile",
      data: { reason: "interval" },
    },
  );
  await queue.close();
}

startWorkerHealthServer();
setupRepeatable().catch((error) => {
  logger.error({ err: String(error) }, "failed to schedule reconcile job");
});

for (const worker of workers) {
  worker.on("failed", (job, err) => {
    logger.error(
      { queue: worker.name, jobId: job?.id, err: err.message },
      "worker job failed",
    );
  });
}

async function shutdown() {
  logger.info("worker shutting down");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

logger.info(
  {
    concurrency: env.EMAIL_WORKER_CONCURRENCY,
    rateLimit: env.EMAIL_RATE_LIMIT_PER_SECOND,
    provider: env.EMAIL_PROVIDER,
  },
  "email worker started",
);
