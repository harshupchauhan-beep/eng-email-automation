# ENG Email Automation — Architecture

Internal, single-organization email campaign platform. Not a SaaS product. PostgreSQL is the source of truth. Redis/BullMQ are reconstructable queues.

## 1. System architecture

```mermaid
flowchart LR
  Operator[Operator browser] --> Web[Next.js web/API]
  Web --> PG[(PostgreSQL)]
  Web --> Redis[(Redis / BullMQ)]
  Worker[Worker process] --> PG
  Worker --> Redis
  Worker --> Provider[Email provider adapter]
  Provider --> SES[Amazon SES]
  Provider --> SG[SendGrid]
  Provider --> MG[Mailgun]
  Provider --> PM[Postmark]
  Provider --> Fake[Fake provider]
  Provider -->|webhooks| Web
  Web -->|enqueue| Redis
```

The UI never sends bulk mail. "Send" creates an immutable `CampaignSend` snapshot, writes `CampaignRecipient` rows in the worker, and enqueues delivery jobs.

## 2. Database ER diagram

```mermaid
erDiagram
  User ||--o{ Session : has
  User ||--o{ Campaign : creates
  User ||--o{ AuditLog : records
  Contact ||--o{ ContactTag : tagged
  Tag ||--o{ ContactTag : on
  Segment ||--o{ Campaign : usedBy
  Template ||--o{ TemplateVersion : versions
  Template ||--o{ Campaign : usedBy
  Campaign ||--o| CampaignSend : snapshot
  CampaignSend ||--o{ CampaignRecipient : recipients
  CampaignRecipient ||--o{ EmailDelivery : attempts
  CampaignRecipient ||--o{ EmailEvent : events
  Suppression ||--o{ Contact : blocks
```

## 3. Campaign state machine

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> READY
  DRAFT --> SCHEDULED
  DRAFT --> QUEUING
  SCHEDULED --> QUEUING
  QUEUING --> QUEUED
  QUEUING --> CANCELLED
  QUEUED --> SENDING
  QUEUED --> PAUSED
  QUEUED --> CANCELLED
  SENDING --> PAUSED
  SENDING --> COMPLETED
  SENDING --> PARTIALLY_FAILED
  SENDING --> FAILED
  SENDING --> CANCELLED
  PAUSED --> SENDING
  PAUSED --> CANCELLED
  COMPLETED --> [*]
  PARTIALLY_FAILED --> [*]
  FAILED --> [*]
  CANCELLED --> [*]
```

## 4. Email delivery state machine

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> QUEUED
  PENDING --> CANCELLED
  PENDING --> SUPPRESSED
  QUEUED --> PROCESSING
  QUEUED --> CANCELLED
  PROCESSING --> SENT
  PROCESSING --> QUEUED : transient retry
  PROCESSING --> FAILED : permanent
  PROCESSING --> SUPPRESSED
  SENT --> DELIVERED
  SENT --> BOUNCED
  SENT --> COMPLAINED
  SENT --> DEFERRED
```

## 5. Queue architecture

Queues:

- `campaign-materialize` — resolve audience in batches of `EMAIL_BATCH_SIZE`
- `email-send` — one job per recipient, `jobId = idempotencyKey`, concurrency + per-second limiter
- `csv-import` — stream CSV from disk
- `provider-webhook` — verified events
- `campaign-scheduled` — delayed start
- `campaign-reconcile` — repeatable; rebuilds missing jobs from Postgres

Worker limiter: `EMAIL_RATE_LIMIT_PER_SECOND` / 1000ms. Scaling workers multiplies throughput; size to the provider quota, never above it.

## 6. Provider webhook flow

```mermaid
sequenceDiagram
  participant P as Provider
  participant API as Next.js webhook route
  participant Q as BullMQ
  participant W as Worker
  participant DB as PostgreSQL
  P->>API: POST /api/webhooks/{provider}
  API->>API: Verify signature
  API->>Q: Enqueue event (jobId = providerEventId)
  API-->>P: 200
  Q->>W: Process
  W->>DB: Insert EmailEvent unique providerEventId
  alt duplicate
    W-->>W: Ignore
  else new event
    W->>DB: Update recipient + suppression
  end
```

## 7. Idempotency strategy

- Send API: unique `CampaignSend.campaignId` and unique `idempotencyKey`. Repeat POST returns the existing send.
- Recipient: unique `(campaignSendId, emailNormalized)` and unique `idempotencyKey`.
- BullMQ `jobId = idempotencyKey` so Redis reconnects do not create a second job.
- Worker claims with `UPDATE ... WHERE status IN (QUEUED, PENDING, FAILED)`.
- Terminal statuses (`SENT`, `DELIVERED`, ...) are never resent, including after pause/resume or worker crash.
- Webhooks: unique `providerEventId`.

## 8. Failure / recovery

| Failure | Response |
| --- | --- |
| Redis down | HTTP send still writes CampaignSend; reconcile requeues from Postgres |
| Postgres down | API/worker fail closed; no send without durable recipient rows |
| Provider timeout/throttle | Transient retry with exponential backoff + jitter; throttle adds extra delay |
| Worker crash | In-flight PROCESSING rows are requeued after `STUCK_PROCESSING_MS` |
| Duplicate webhook | Unique event id, no second suppression/status write |
| Malformed CSV | Row counted invalid; job continues |
| Partial completion | Campaign `PARTIALLY_FAILED`; remaining eligible rows stay queryable |

## 9. Security model

- No public registration. Admin-created users only.
- Roles: Admin > Operator > Viewer.
- HttpOnly session cookies, hashed tokens in Postgres, login rate limits.
- CSRF origin check on mutating API requests.
- Webhook signature verification per provider.
- HMAC unsubscribe tokens (no sequential ids).
- Secrets never sent to the browser or written to logs.
- Templates interpolate escaped variables only.

## 10. Project directory structure

```
src/app/(app)          Authenticated pages
src/app/api            Route handlers
src/app/unsubscribe    Public unsubscribe
src/components         App shell + shadcn/ui
src/lib/auth.ts        Sessions
src/lib/campaigns      Send snapshot, audience, pause/resume
src/lib/email          Provider adapters, render, webhooks
src/lib/queue          BullMQ
src/worker             Dedicated worker process
prisma                 Schema + migrations
tests                  Unit tests
scripts/load-test.ts   Fake-provider 30k harness
```
