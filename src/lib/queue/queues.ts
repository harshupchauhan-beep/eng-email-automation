import { Queue, QueueEvents } from "bullmq";
import { getEnv } from "../env";
import { getRedis } from "./redis";
import {
  QUEUE_NAMES,
  ImportJobData,
  MaterializeJobData,
  ReconcileJobData,
  ScheduledJobData,
  SendJobData,
  WebhookJobData,
} from "./types";

function connection() {
  return getRedis();
}

const defaultJobOptions = {
  removeOnComplete: { count: 2000 },
  removeOnFail: { count: 5000 },
};

export function getMaterializeQueue() {
  return new Queue<MaterializeJobData>(QUEUE_NAMES.materialize, {
    connection: connection(),
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
    },
  });
}

export function getSendQueue() {
  const env = getEnv();
  return new Queue<SendJobData>(QUEUE_NAMES.send, {
    connection: connection(),
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: env.EMAIL_MAX_RETRIES + 1,
      backoff: { type: "exponential", delay: env.EMAIL_RETRY_BASE_MS },
    },
  });
}

export function getImportQueue() {
  return new Queue<ImportJobData>(QUEUE_NAMES.csvImport, {
    connection: connection(),
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 2,
      backoff: { type: "exponential", delay: 3000 },
    },
  });
}

export function getWebhookQueue() {
  return new Queue<WebhookJobData>(QUEUE_NAMES.webhook, {
    connection: connection(),
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 8,
      backoff: { type: "exponential", delay: 1000 },
    },
  });
}

export function getScheduledQueue() {
  return new Queue<ScheduledJobData>(QUEUE_NAMES.scheduled, {
    connection: connection(),
    defaultJobOptions,
  });
}

export function getReconcileQueue() {
  return new Queue<ReconcileJobData>(QUEUE_NAMES.reconcile, {
    connection: connection(),
    defaultJobOptions,
  });
}

export async function enqueueSendJobs(
  items: { campaignRecipientId: string; campaignSendId: string; idempotencyKey: string }[],
) {
  const queue = getSendQueue();
  const jobs = items.map((item) => ({
    name: "send",
    data: {
      campaignRecipientId: item.campaignRecipientId,
      campaignSendId: item.campaignSendId,
    },
    opts: {
      jobId: item.idempotencyKey,
      attempts: getEnv().EMAIL_MAX_RETRIES + 1,
      backoff: { type: "exponential" as const, delay: getEnv().EMAIL_RETRY_BASE_MS },
    },
  }));
  if (jobs.length === 0) return;
  await queue.addBulk(jobs);
  await queue.close();
}

export async function enqueueMaterialize(data: MaterializeJobData) {
  const queue = getMaterializeQueue();
  await queue.add("materialize", data, { jobId: `materialize:${data.campaignSendId}` });
  await queue.close();
}

export async function enqueueImport(importJobId: string) {
  const queue = getImportQueue();
  await queue.add("import", { importJobId }, { jobId: `import:${importJobId}` });
  await queue.close();
}

export async function enqueueWebhook(data: WebhookJobData, eventId: string) {
  const queue = getWebhookQueue();
  await queue.add("webhook", data, { jobId: `webhook:${data.provider}:${eventId}` });
  await queue.close();
}

export async function enqueueScheduled(campaignId: string, runAt: Date) {
  const queue = getScheduledQueue();
  const delay = Math.max(0, runAt.getTime() - Date.now());
  await queue.add("start", { campaignId }, { jobId: `scheduled:${campaignId}`, delay });
  await queue.close();
}

export async function getQueueMetrics() {
  const names = Object.values(QUEUE_NAMES);
  const metrics = [];
  for (const name of names) {
    const queue = new Queue(name, { connection: connection() });
    const [waiting, active, delayed, failed, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getFailedCount(),
      queue.getCompletedCount(),
    ]);
    metrics.push({ name, waiting, active, delayed, failed, completed });
    await queue.close();
  }
  return metrics;
}

export function sendQueueEvents() {
  return new QueueEvents(QUEUE_NAMES.send, { connection: connection() });
}
