import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { cancelCampaign } from "@/lib/campaigns/control";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(
    request,
    async ({ user, ip }) => {
      const result = await cancelCampaign(id, user.id, ip);
      return NextResponse.json({
        ok: true,
        ...result,
        warning:
          "Cancellation stops remaining queued deliveries. Messages already accepted by the email provider cannot be recalled.",
      });
    },
    { role: "OPERATOR" },
  );
}
