export const QUEUE_NAMES = {
  materialize: "campaign-materialize",
  send: "email-send",
  csvImport: "csv-import",
  webhook: "provider-webhook",
  scheduled: "campaign-scheduled",
  reconcile: "campaign-reconcile",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type MaterializeJobData = {
  campaignSendId: string;
  campaignId: string;
};

export type SendJobData = {
  campaignRecipientId: string;
  campaignSendId: string;
};

export type ImportJobData = {
  importJobId: string;
};

export type WebhookJobData = {
  provider: string;
  payload: unknown;
  headers: Record<string, string>;
};

export type ScheduledJobData = {
  campaignId: string;
};

export type ReconcileJobData = {
  reason: string;
};
