import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AudienceType, Prisma } from "@prisma/client";
import { parsePage, withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { getEnv } from "@/lib/env";
import { estimateAudience, type AudienceConfig } from "@/lib/campaigns/audience";

const schema = z.object({
  name: z.string().min(1),
  fromName: z.string().min(1),
  fromEmail: z.string().email(),
  replyTo: z.string().email().optional().or(z.literal("")),
  subject: z.string().min(1),
  preheader: z.string().optional(),
  templateId: z.string().optional(),
  audienceType: z.enum(["ALL", "TAGS", "SEGMENT", "MANUAL"]),
  audienceConfig: z.record(z.string(), z.unknown()).optional(),
  segmentId: z.string().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  sendNow: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  return withApi(request, async () => {
    const { skip, take, page, pageSize } = parsePage(request);
    const status = request.nextUrl.searchParams.get("status");
    const where = status ? { status: status as never } : {};
    const [items, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { template: { include: { currentVersion: true } } },
      }),
      prisma.campaign.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  });
}

export async function POST(request: NextRequest) {
  return withApi(
    request,
    async ({ user, ip }) => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const env = getEnv();
      const campaign = await prisma.campaign.create({
        data: {
          name: parsed.data.name,
          fromName: parsed.data.fromName,
          fromEmail: parsed.data.fromEmail,
          replyTo: parsed.data.replyTo || env.EMAIL_REPLY_TO,
          subject: parsed.data.subject,
          preheader: parsed.data.preheader,
          templateId: parsed.data.templateId,
          audienceType: parsed.data.audienceType as AudienceType,
          audienceConfig: (parsed.data.audienceConfig ?? {}) as Prisma.InputJsonValue,
          segmentId: parsed.data.segmentId,
          scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
          sendNow: parsed.data.sendNow ?? !parsed.data.scheduledAt,
          cancellationWindowSeconds: env.CAMPAIGN_CANCELLATION_WINDOW_SECONDS,
          createdById: user.id,
          status: "DRAFT",
        },
      });
      const estimate = await estimateAudience({
        audienceType: campaign.audienceType,
        audienceConfig: campaign.audienceConfig as AudienceConfig,
        segmentId: campaign.segmentId,
      });
      await writeAuditLog({
        userId: user.id,
        action: "campaign.create",
        entityType: "Campaign",
        entityId: campaign.id,
        ipAddress: ip,
      });
      return NextResponse.json({ campaign, estimate }, { status: 201 });
    },
    { role: "OPERATOR" },
  );
}
