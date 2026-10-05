/**
 * Development-only load harness for ~30,000 recipients using the fake provider.
 * Never point this at a production provider or a real recipient list.
 *
 * Prerequisites: Postgres, Redis, migrated schema, worker running, EMAIL_PROVIDER=fake.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { performance } from "node:perf_hooks";

const prisma = new PrismaClient();
const COUNT = Number(process.env.LOAD_TEST_COUNT ?? 30000);

async function main() {
  if (process.env.EMAIL_PROVIDER !== "fake") {
    throw new Error("Refusing to run load test unless EMAIL_PROVIDER=fake");
  }
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("Seed an admin user first");

  const started = performance.now();
  const batch = 1000;
  for (let i = 0; i < COUNT; i += batch) {
    const rows = Array.from({ length: Math.min(batch, COUNT - i) }, (_, idx) => {
      const n = i + idx;
      return {
        email: `loadtest-${n}@example.test`,
        emailNormalized: `loadtest-${n}@example.test`,
        firstName: "Load",
        lastName: String(n),
        source: "load-test",
      };
    });
    await prisma.contact.createMany({ data: rows, skipDuplicates: true });
  }
  const insertMs = performance.now() - started;

  const template = await prisma.template.findFirst({ include: { currentVersion: true } });
  if (!template?.currentVersion) throw new Error("Seed a template first");

  const campaign = await prisma.campaign.create({
    data: {
      name: `Load test ${COUNT}`,
      fromName: "Load Test",
      fromEmail: process.env.EMAIL_FROM_ADDRESS ?? "noreply@example.com",
      subject: "Load {{firstName}}",
      templateId: template.id,
      audienceType: "ALL",
      createdById: admin.id,
      status: "DRAFT",
    },
  });

  console.info(
    JSON.stringify(
      {
        contactsInsertedMs: Math.round(insertMs),
        campaignId: campaign.id,
        count: COUNT,
        next: `POST /api/campaigns/${campaign.id}/send with confirm=true. Measure worker throughput from /api/metrics.`,
        warning: "Do not run against real recipients.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
