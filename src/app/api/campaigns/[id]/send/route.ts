import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApi } from "@/lib/api";
import { initiateCampaignSend } from "@/lib/campaigns/send";

const schema = z.object({
  idempotencyKey: z.string().min(8),
  confirm: z.literal(true),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(
    request,
    async ({ user, ip }) => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Confirmation and idempotency key are required" },
          { status: 400 },
        );
      }
      const result = await initiateCampaignSend({
        campaignId: id,
        userId: user.id,
        idempotencyKey: parsed.data.idempotencyKey,
        ipAddress: ip,
      });
      return NextResponse.json({
        campaignSend: result.campaignSend,
        replayed: result.replayed,
      });
    },
    { role: "OPERATOR" },
  );
}
