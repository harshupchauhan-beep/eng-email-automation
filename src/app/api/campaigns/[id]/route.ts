import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { estimateAudience, type AudienceConfig } from "@/lib/campaigns/audience";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(request, async () => {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        template: { include: { currentVersion: true } },
        send: true,
        createdBy: { select: { name: true, email: true } },
        segment: true,
      },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const estimate = await estimateAudience({
      audienceType: campaign.audienceType,
      audienceConfig: campaign.audienceConfig as AudienceConfig,
      segmentId: campaign.segmentId,
    });
    return NextResponse.json({ campaign, estimate });
  });
}
