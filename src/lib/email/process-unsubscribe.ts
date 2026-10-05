import { prisma } from "../db";
import { suppressAddress } from "./suppression";
import { verifyUnsubscribeToken } from "./unsubscribe";
import { writeAuditLog } from "../audit";

export async function processUnsubscribeToken(token: string) {
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) return { ok: false as const, error: "Invalid or expired unsubscribe link" };
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: parsed.recipientId },
  });
  if (!recipient) return { ok: false as const, error: "Recipient not found" };
  await suppressAddress({
    email: recipient.email,
    reason: "UNSUBSCRIBE",
    source: "unsubscribe-link",
  });
  await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: { unsubscribedAt: new Date() },
  });
  await writeAuditLog({
    action: "contact.unsubscribe",
    entityType: "Contact",
    entityId: recipient.contactId,
    metadata: { emailNormalized: recipient.emailNormalized },
  });
  return { ok: true as const };
}
