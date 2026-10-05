export type SendRequest = {
  to: string;
  from: { email: string; name?: string };
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  idempotencyKey: string;
  campaignRecipientId: string;
  campaignSendId: string;
  unsubscribeUrl: string;
};

export type SendSuccess = {
  ok: true;
  providerMessageId: string;
  accepted: boolean;
};

export type SendFailure = {
  ok: false;
  retryable: boolean;
  category: "TRANSIENT" | "PERMANENT" | "PROVIDER_REJECTED" | "THROTTLED";
  statusCode?: number;
  error: string;
};

export type SendResult = SendSuccess | SendFailure;

export interface EmailProviderAdapter {
  name: string;
  send(request: SendRequest): Promise<SendResult>;
  verifyWebhook?(rawBody: string, headers: Record<string, string>): Promise<boolean>;
}

export class ProviderThrottleError extends Error {
  retryable = true;
  constructor(message: string) {
    super(message);
    this.name = "ProviderThrottleError";
  }
}
