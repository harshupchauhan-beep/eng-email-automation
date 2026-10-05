# ENG Email Automation

Internal email campaign platform for a single organization. It is not a SaaS product: there is no public registration, billing, tenancy, or plan management.

An operator can import tens of thousands of contacts, compose a campaign, confirm send, and walk away. The HTTP request only creates an immutable send snapshot and background work. Workers deliver mail at the configured provider rate. PostgreSQL remains authoritative if Redis is lost.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for diagrams: system, ER, campaign/delivery state machines, queues, webhooks, idempotency, recovery, and security.

Processes:

- `app` — Next.js UI + API
- `worker` — BullMQ consumers + health server on port 3001
- `postgres` — source of truth
- `redis` — job transport only

## Local setup

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
npm run worker
```

Open http://localhost:3000 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

Full stack:

```bash
docker compose up --build
```

Run migrations first:

```bash
docker compose run --rm migrate
```

## Database migrations

```bash
npm run db:migrate     # development
npm run db:deploy      # production
npm run db:seed
```

Never put credentials in the schema or in git.

## Environment variables

Copy `.env.example`. Important groups:

- `DATABASE_URL`, `REDIS_URL`
- `SESSION_SECRET`, `UNSUBSCRIBE_SECRET`, `WEBHOOK_SECRET`
- `EMAIL_PROVIDER` (`fake` | `ses` | `sendgrid` | `mailgun` | `postmark`)
- `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`
- `EMAIL_WORKER_CONCURRENCY`, `EMAIL_RATE_LIMIT_PER_SECOND`, `EMAIL_BATCH_SIZE`, `EMAIL_MAX_RETRIES`
- `APP_URL`, `ORG_NAME`, `ORG_PHYSICAL_ADDRESS`

Do not commit real secrets.

## Redis

Redis stores BullMQ jobs. If Redis is wiped, the reconcile worker (`campaign-reconcile`, every `RECONCILE_INTERVAL_MS`) finds `PENDING` / `QUEUED` / stuck `PROCESSING` rows and re-adds jobs using the recipient `idempotencyKey` as `jobId`.

## Worker deployment

Run `npm run worker` (or the `worker` Compose service) as a separate process. Scale replicas only up to provider quota:

`effective_throughput ≈ replicas × EMAIL_RATE_LIMIT_PER_SECOND`

Health: `GET http://localhost:3001/health` and `/ready`.

## Provider configuration

Set `EMAIL_PROVIDER` and the matching credentials. Campaign logic talks only to `src/lib/email/provider.ts`. Switching providers does not change send/snapshot code.

Development and load tests must use `EMAIL_PROVIDER=fake`.

## Webhook configuration

Point the provider at:

`https://<APP_URL>/api/webhooks/<provider>`

- SES: SNS topic on the configuration set; signing cert host is checked
- SendGrid: signed event webhook + `SENDGRID_WEBHOOK_VERIFICATION_KEY`
- Mailgun: signing key HMAC (`timestamp + token`)
- Postmark: `POSTMARK_WEBHOOK_TOKEN`
- Fake: header `x-webhook-secret: WEBHOOK_SECRET`

Webhook handlers verify first, enqueue second, and persist `providerEventId` uniquely.

## SPF, DKIM, DMARC, sending-domain verification

These are DNS / provider-console tasks, not application tricks.

1. Verify the sending domain with the provider.
2. Publish SPF including the provider’s include mechanism.
3. Enable DKIM and publish the CNAME/TXT records the provider shows.
4. Publish a DMARC policy starting at `p=none` and tightening after monitoring.
5. Mark the matching checklist items on **Settings**.

This application will not rotate domains to evade reputation, bypass suppression, fake engagement, or disguise the sender.

## Production deployment

1. Provision Postgres 16 and Redis 7.
2. Set secrets via the host environment or a secret manager.
3. `prisma migrate deploy`
4. `prisma db seed` once to create the admin user, then rotate the password.
5. Run `app` (`node server.js` from Next standalone) and one or more `worker` processes.
6. Terminate TLS in front of the app; set `APP_URL` to the public HTTPS origin.
7. Restrict inbound access (VPN / SSO / IP allow list). This is an internal tool.

## Backups

- PostgreSQL: nightly logical dumps plus WAL/PITR if available. Restore is the recovery path for campaign state.
- Redis: AOF is enabled in Compose; Redis is still not the source of truth.
- `uploads/` holds CSV files in flight; they can be discarded after import jobs complete.

## Monitoring

- `GET /api/health` — liveness
- `GET /api/ready` — Postgres, Redis, worker heartbeat
- `GET /api/metrics` — queue depths and failed deliveries
- Structured logs include `campaignId`, `campaignSendId`, `campaignRecipientId`, `jobId`, `providerMessageId`
- Audit log UI at `/audit-logs`

## Queue recovery

If jobs vanish:

1. Confirm Postgres is healthy.
2. Restart workers.
3. Wait one reconcile interval, or `POST` is unnecessary — reconcile is repeatable.
4. Stuck `PROCESSING` older than `STUCK_PROCESSING_MS` returns to `QUEUED` and is re-enqueued.

## Scaling workers

Increase replicas or `EMAIL_WORKER_CONCURRENCY` only after checking provider caps. If the provider returns 429, workers treat it as throttle, delay, and retry. Do not raise retry aggression to “push through” a quota.

## Rollback strategy

1. Keep previous Docker image tags.
2. App/worker are stateless; roll back the image.
3. Do not roll back Prisma migrations that already expanded production data. Prefer expand/contract.
4. Pause the campaign (`/campaigns/[id]`) before a risky deploy if a send is in flight.

## Testing

```bash
npm test
```

Critical coverage:

- Template escaping and fallbacks
- Unsubscribe token tamper resistance
- Webhook auth and event mapping
- Fake provider throttle classification
- Campaign/delivery state machine (no resend of SENT after pause)

Load test (fake provider only):

```bash
EMAIL_PROVIDER=fake npm run load-test
```

Then send the created campaign from the UI. Capture enqueue time, worker throughput (`/api/metrics`), database load, Redis depth, and process memory from your host metrics. Never run this against real recipients.

## Operational safeguards

- Confirmation screen states the eligible count.
- Large sends require an extra checkbox.
- Idempotency key on Send.
- Configurable cancellation window (`CAMPAIGN_CANCELLATION_WINDOW_SECONDS`).
- Pause/resume/cancel do not resend completed recipients.
- Cancellation cannot recall provider-accepted mail.
