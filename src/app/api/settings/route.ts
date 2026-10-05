import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  orgName: z.string().optional(),
  physicalAddress: z.string().optional(),
  timezone: z.string().optional(),
  spfConfigured: z.boolean().optional(),
  dkimConfigured: z.boolean().optional(),
  dmarcConfigured: z.boolean().optional(),
  domainVerified: z.boolean().optional(),
  webhooksConfigured: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const env = getEnv();
    const rows = await prisma.setting.findMany();
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const checklist = {
      providerConfigured: env.EMAIL_PROVIDER !== "fake" || env.NODE_ENV !== "production",
      fromAddress: Boolean(env.EMAIL_FROM_ADDRESS),
      physicalAddress: Boolean(
        (typeof settings.physicalAddress === "string" && settings.physicalAddress) ||
          env.ORG_PHYSICAL_ADDRESS,
      ),
      unsubscribeSecret: Boolean(env.UNSUBSCRIBE_SECRET),
      redis: true,
      postgres: true,
      spfConfigured: settings.spfConfigured === true,
      dkimConfigured: settings.dkimConfigured === true,
      dmarcConfigured: settings.dmarcConfigured === true,
      domainVerified: settings.domainVerified === true,
      webhooksConfigured: settings.webhooksConfigured === true,
    };
    return NextResponse.json({
      settings,
      env: {
        provider: env.EMAIL_PROVIDER,
        fromAddress: env.EMAIL_FROM_ADDRESS,
        fromName: env.EMAIL_FROM_NAME,
        timezone: env.APP_TIMEZONE,
        workerConcurrency: env.EMAIL_WORKER_CONCURRENCY,
        rateLimit: env.EMAIL_RATE_LIMIT_PER_SECOND,
        batchSize: env.EMAIL_BATCH_SIZE,
        maxRetries: env.EMAIL_MAX_RETRIES,
        cancellationWindow: env.CAMPAIGN_CANCELLATION_WINDOW_SECONDS,
        openTracking: env.ENABLE_OPEN_TRACKING,
        clickTracking: env.ENABLE_CLICK_TRACKING,
        webhookUrl: `${env.APP_URL}/api/webhooks/${env.EMAIL_PROVIDER}`,
      },
      checklist,
    });
  });
}

export async function PATCH(request: NextRequest) {
  return withApi(
    request,
    async ({ user, ip }) => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value === undefined) continue;
        await prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
      await writeAuditLog({
        userId: user.id,
        action: "settings.update",
        entityType: "Setting",
        ipAddress: ip,
      });
      return NextResponse.json({ ok: true });
    },
    { role: "ADMIN" },
  );
}
