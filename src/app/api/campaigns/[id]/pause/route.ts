import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { pauseCampaign } from "@/lib/campaigns/control";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(
    request,
    async ({ user, ip }) => {
      await pauseCampaign(id, user.id, ip);
      return NextResponse.json({ ok: true });
    },
    { role: "OPERATOR" },
  );
}
