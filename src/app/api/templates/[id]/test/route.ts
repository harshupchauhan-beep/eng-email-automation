import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getEmailProvider } from "@/lib/email/provider";
import { appendUnsubscribeAndIdentity, flattenPersonalization, renderEmail } from "@/lib/email/render";
import { getEnv } from "@/lib/env";
import { isValidEmail } from "@/lib/crypto";

const schema = z.object({
  to: z.string().email(),
  contactId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withApi(
    request,
    async () => {
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success || !isValidEmail(parsed.data.to)) {
        return NextResponse.json({ error: "Valid test recipient is required" }, { status: 400 });
      }
      const template = await prisma.template.findUnique({
        where: { id },
        include: { currentVersion: true },
      });
      if (!template?.currentVersion) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      let vars: Record<string, string> = {
        email: parsed.data.to,
        firstName: "Test",
        lastName: "Recipient",
        company: getEnv().ORG_NAME,
      };
      if (parsed.data.contactId) {
        const contact = await prisma.contact.findUnique({ where: { id: parsed.data.contactId } });
        if (contact) {
          vars = flattenPersonalization(
            {
              email: contact.email,
              firstName: contact.firstName ?? "",
              lastName: contact.lastName ?? "",
              company: contact.company ?? "",
            },
            (contact.customFields as Record<string, unknown>) ?? {},
          );
        }
      }
      const rendered = renderEmail({
        subject: `[TEST] ${template.currentVersion.subject}`,
        preheader: template.currentVersion.preheader,
        html: template.currentVersion.htmlBody,
        text: template.currentVersion.textBody,
        vars,
        fallbacks: (template.currentVersion.fallbacks as Record<string, string>) ?? {},
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
        from: { email: env.EMAIL_FROM_ADDRESS, name: env.EMAIL_FROM_NAME },
        replyTo: env.EMAIL_REPLY_TO,
        subject: rendered.subject,
        html: withFooter.html,
        text: withFooter.text,
        idempotencyKey: `test-template-${id}-${Date.now()}`,
        campaignRecipientId: "test",
        campaignSendId: "test",
        unsubscribeUrl: `${env.APP_URL}/unsubscribe/test`,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      return NextResponse.json({ ok: true, providerMessageId: result.providerMessageId });
    },
    { role: "OPERATOR" },
  );
}
