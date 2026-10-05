import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "change-me-now";
  const name = process.env.ADMIN_NAME ?? "Administrator";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "ADMIN", active: true },
    create: { email, name, passwordHash, role: "ADMIN" },
  });

  await prisma.setting.upsert({
    where: { key: "orgName" },
    update: {},
    create: { key: "orgName", value: process.env.ORG_NAME ?? "Example Organization" },
  });
  await prisma.setting.upsert({
    where: { key: "physicalAddress" },
    update: {},
    create: {
      key: "physicalAddress",
      value: process.env.ORG_PHYSICAL_ADDRESS ?? "123 Example Street, City, Country",
    },
  });

  const template = await prisma.template.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Welcome",
    },
  });
  const version = await prisma.templateVersion.upsert({
    where: { templateId_version: { templateId: template.id, version: 1 } },
    update: {},
    create: {
      templateId: template.id,
      version: 1,
      subject: "Hello {{firstName}}",
      preheader: "A message from {{company}}",
      htmlBody: "<h1>Hello {{firstName}}</h1><p>Thanks for staying in touch with {{company}}.</p>",
      textBody: "Hello {{firstName}}\n\nThanks for staying in touch with {{company}}.",
      fallbacks: { firstName: "there", company: "us" },
    },
  });
  await prisma.template.update({
    where: { id: template.id },
    data: { currentVersionId: version.id },
  });

  console.info(`Seeded admin ${email} and sample template.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
