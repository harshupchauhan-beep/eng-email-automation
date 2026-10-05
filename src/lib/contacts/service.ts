import { ContactStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { isValidEmail, normalizeEmail } from "../crypto";

export type ContactInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phone?: string | null;
  source?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  status?: ContactStatus;
};

export async function upsertTags(names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const tags = [];
  for (const name of unique) {
    tags.push(await prisma.tag.upsert({ where: { name }, update: {}, create: { name } }));
  }
  return tags;
}

export async function createContact(input: ContactInput) {
  if (!isValidEmail(input.email)) throw new Error("Invalid email");
  const emailNormalized = normalizeEmail(input.email);
  const suppressed = await prisma.suppression.findUnique({ where: { emailNormalized } });
  const status: ContactStatus = suppressed
    ? "SUPPRESSED"
    : (input.status ?? "ACTIVE");
  const tags = await upsertTags(input.tags ?? []);
  return prisma.contact.create({
    data: {
      email: input.email.trim(),
      emailNormalized,
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company,
      phone: input.phone,
      source: input.source ?? "manual",
      customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
      status,
      tags: { create: tags.map((t) => ({ tagId: t.id })) },
    },
    include: { tags: { include: { tag: true } } },
  });
}
