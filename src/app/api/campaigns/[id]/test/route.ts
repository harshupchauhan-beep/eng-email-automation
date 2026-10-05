import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getEmailProvider } from "@/lib/email/provider";
import { appendUnsubscribeAndIdentity, flattenPersonalization, renderEmail } from "@/lib/email/render";
import { getEnv } from "@/lib/env";

const schema = z.object({ to: z.string().email() });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(
    request,
    async () => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
      const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: { template: { include: { currentVersion: true } } },
      });
      if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const version = campaign.template?.currentVersion;
      const contact = await prisma.contact.findFirst({ where: { status: "ACTIVE" } });
      const vars = contact
        ? flattenPersonalization(
            {
              email: parsed.data.to,
              firstName: contact.firstName ?? "Test",
              lastName: contact.lastName ?? "User",
              company: contact.company ?? "",
            },
            (contact.customFields as Record<string, unknown>) ?? {},
          )
        : { email: parsed.data.to, firstName: "Test", lastName: "User", company: "" };
      const rendered = renderEmail({
        subject: `[TEST] ${campaign.subject}`,
        preheader: campaign.preheader,
        html: version?.htmlBody ?? "<p>Test</p>",
        text: version?.textBody ?? "Test",
        vars,
        fallbacks: (version?.fallbacks as Record<string, string>) ?? {},
      });
      const env = getEnv();
      const withFooter = appendUnsubscribeAndIdentity({
        html: rendered.html,
        text: rendered.text,
        unsubscribeUrl: `${env.APP_URL}/unsubscribe/test`,
        companyName: env.ORG_NAME,
        physicalAddress: env.ORG_PHYSICAL_ADDRESS,
      });
      const result = await getEmailProvider().send({
        to: parsed.data.to,
        from: { email: campaign.fromEmail, name: campaign.fromName },
        replyTo: campaign.replyTo ?? undefined,
        subject: rendered.subject,
        html: withFooter.html,
        text: withFooter.text,
        idempotencyKey: `campaign-test-${id}-${Date.now()}`,
        campaignRecipientId: "test",
        campaignSendId: "test",
        unsubscribeUrl: `${env.APP_URL}/unsubscribe/test`,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
      return NextResponse.json({ ok: true });
    },
    { role: "OPERATOR" },
  );
}
