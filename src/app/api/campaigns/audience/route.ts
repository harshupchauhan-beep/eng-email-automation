import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { estimateAudience, type AudienceConfig } from "@/lib/campaigns/audience";
import { flattenPersonalization, renderEmail } from "@/lib/email/render";

const schema = z.object({
  audienceType: z.enum(["ALL", "TAGS", "SEGMENT", "MANUAL"]),
  audienceConfig: z.record(z.string(), z.unknown()).optional(),
  segmentId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withApi(request, async () => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
    const estimate = await estimateAudience({
      audienceType: parsed.data.audienceType,
      audienceConfig: (parsed.data.audienceConfig ?? {}) as AudienceConfig,
      segmentId: parsed.data.segmentId,
    });
    return NextResponse.json({ estimate });
  });
}
