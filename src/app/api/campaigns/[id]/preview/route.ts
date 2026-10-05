import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { flattenPersonalization, renderEmail } from "@/lib/email/render";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(request, async () => {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { template: { include: { currentVersion: true } }, send: true },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const contact = await prisma.contact.findFirst({
      where: { status: "ACTIVE", archivedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const version = campaign.template?.currentVersion;
    const vars = contact
      ? flattenPersonalization(
          {
            email: contact.email,
            firstName: contact.firstName ?? "",
            lastName: contact.lastName ?? "",
            company: contact.company ?? "",
          },
          (contact.customFields as Record<string, unknown>) ?? {},
        )
      : { email: "preview@example.com", firstName: "Alex", lastName: "Rivera", company: "Example Co" };
    const rendered = renderEmail({
      subject: campaign.subject || version?.subject || "",
      preheader: campaign.preheader ?? version?.preheader,
      html: version?.htmlBody ?? "<p>No template selected.</p>",
      text: version?.textBody ?? "",
      vars,
      fallbacks: (version?.fallbacks as Record<string, string>) ?? {},
    });
    return NextResponse.json({ rendered, sampleContact: contact, vars });
  });
}
