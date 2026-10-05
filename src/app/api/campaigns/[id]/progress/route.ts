import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(request, async () => {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { send: { select: { id: true, status: true, eligibleCount: true, cancelAfter: true } } },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: campaign.id,
      status: campaign.status,
      stats: {
        selected: campaign.statsSelected,
        eligible: campaign.statsEligible,
        queued: campaign.statsQueued,
        processing: campaign.statsProcessing,
        sent: campaign.statsSent,
        delivered: campaign.statsDelivered,
        failed: campaign.statsFailed,
        bounced: campaign.statsBounced,
        complained: campaign.statsComplained,
        unsubscribed: campaign.statsUnsubscribed,
        suppressed: campaign.statsSuppressed,
      },
      send: campaign.send,
    });
  });
}
