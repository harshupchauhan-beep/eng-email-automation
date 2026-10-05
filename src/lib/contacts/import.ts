import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import { ContactStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getEnv } from "../env";
import { isValidEmail, normalizeEmail } from "../crypto";
import { childLogger } from "../logger";
import { writeAuditLog } from "../audit";

const log = childLogger({ module: "csv-import" });

type Row = Record<string, string>;

function pick(row: Row, keys: string[]) {
  for (const key of keys) {
    const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key.toLowerCase());
    if (found && row[found]) return row[found].trim();
  }
  return "";
}

function parseTags(value: string) {
  return value
    .split(/[|,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseCustom(row: Row) {
  const known = new Set([
    "email",
    "firstname",
    "first_name",
    "lastname",
    "last_name",
    "company",
    "phone",
    "tags",
    "source",
    "status",
  ]);
  const custom: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!known.has(key.trim().toLowerCase()) && value) custom[key.trim()] = value.trim();
  }
  return custom;
}

export async function processCsvImport(importJobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: importJobId } });
  if (!job) throw new Error("Import job not found");
  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "PROCESSING" },
  });

  const env = getEnv();
  const batchSize = env.EMAIL_BATCH_SIZE;
  const parser = createReadStream(job.filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }),
  );

  let total = 0;
  let imported = 0;
  let duplicates = 0;
  let invalid = 0;
  let suppressed = 0;
  let failed = 0;
  let batch: Row[] = [];

  try {
    for await (const record of parser as AsyncIterable<Row>) {
      total += 1;
      batch.push(record);
      if (batch.length >= batchSize) {
        const counts = await flushBatch(batch, job.createdById);
        imported += counts.imported;
        duplicates += counts.duplicates;
        invalid += counts.invalid;
        suppressed += counts.suppressed;
        failed += counts.failed;
        batch = [];
        if (total % (batchSize * 4) === 0) {
          await prisma.importJob.update({
            where: { id: importJobId },
            data: { totalRows: total, imported, duplicates, invalid, suppressed, failed },
          });
        }
      }
    }
    if (batch.length) {
      const counts = await flushBatch(batch, job.createdById);
      imported += counts.imported;
      duplicates += counts.duplicates;
      invalid += counts.invalid;
      suppressed += counts.suppressed;
      failed += counts.failed;
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: "COMPLETED",
        totalRows: total,
        imported,
        duplicates,
        invalid,
        suppressed,
        failed,
        completedAt: new Date(),
      },
    });
    await writeAuditLog({
      userId: job.createdById,
      action: "contact.import",
      entityType: "ImportJob",
      entityId: importJobId,
      metadata: { total, imported, duplicates, invalid, suppressed, failed },
    });
    log.info({ importJobId, total, imported, duplicates, invalid, suppressed, failed }, "csv import completed");
  } catch (error) {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        totalRows: total,
        imported,
        duplicates,
        invalid,
        suppressed,
        failed,
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function flushBatch(rows: Row[], _userId: string) {
  const counts = { imported: 0, duplicates: 0, invalid: 0, suppressed: 0, failed: 0 };
  const prepared = [];
  for (const row of rows) {
    const email = pick(row, ["email", "email_address", "e-mail"]);
    if (!isValidEmail(email)) {
      counts.invalid += 1;
      continue;
    }
    prepared.push({
      email: email.trim(),
      emailNormalized: normalizeEmail(email),
      firstName: pick(row, ["firstName", "first_name", "firstname"]) || null,
      lastName: pick(row, ["lastName", "last_name", "lastname"]) || null,
      company: pick(row, ["company", "organization"]) || null,
      phone: pick(row, ["phone", "phone_number"]) || null,
      source: pick(row, ["source"]) || "csv",
      tags: parseTags(pick(row, ["tags", "tag"])),
      customFields: parseCustom(row),
    });
  }
  if (prepared.length === 0) return counts;

  const emails = prepared.map((p) => p.emailNormalized);
  const [existing, suppressedRows] = await Promise.all([
    prisma.contact.findMany({
      where: { emailNormalized: { in: emails } },
      select: { emailNormalized: true, status: true },
    }),
    prisma.suppression.findMany({
      where: { emailNormalized: { in: emails } },
      select: { emailNormalized: true },
    }),
  ]);
  const existingMap = new Map(existing.map((e) => [e.emailNormalized, e]));
  const suppressedSet = new Set(suppressedRows.map((s) => s.emailNormalized));

  const toInsert: typeof prepared = [];
  for (const row of prepared) {
    if (suppressedSet.has(row.emailNormalized)) {
      counts.suppressed += 1;
      continue;
    }
    const found = existingMap.get(row.emailNormalized);
    if (found) {
      counts.duplicates += 1;
      continue;
    }
    toInsert.push(row);
  }

  const tagNames = [...new Set(toInsert.flatMap((r) => r.tags))];
  const tags = [];
  for (const name of tagNames) {
    tags.push(
      await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    );
  }
  const tagIdByName = new Map(tags.map((t) => [t.name, t.id]));

  try {
    if (toInsert.length) {
      await prisma.contact.createMany({
        data: toInsert.map((r) => ({
          email: r.email,
          emailNormalized: r.emailNormalized,
          firstName: r.firstName,
          lastName: r.lastName,
          company: r.company,
          phone: r.phone,
          source: r.source,
          customFields: r.customFields as Prisma.InputJsonValue,
          status: "ACTIVE" as ContactStatus,
        })),
        skipDuplicates: true,
      });
      const created = await prisma.contact.findMany({
        where: { emailNormalized: { in: toInsert.map((r) => r.emailNormalized) } },
        select: { id: true, emailNormalized: true },
      });
      const idByEmail = new Map(created.map((c) => [c.emailNormalized, c.id]));
      const tagRows: { contactId: string; tagId: string }[] = [];
      for (const row of toInsert) {
        const contactId = idByEmail.get(row.emailNormalized);
        if (!contactId) continue;
        for (const name of row.tags) {
          const tagId = tagIdByName.get(name);
          if (tagId) tagRows.push({ contactId, tagId });
        }
      }
      if (tagRows.length) {
        await prisma.contactTag.createMany({ data: tagRows, skipDuplicates: true });
      }
      counts.imported += toInsert.length;
    }
  } catch (error) {
    counts.failed += toInsert.length;
    log.error({ err: error instanceof Error ? error.message : String(error) }, "batch insert failed");
  }

  return counts;
}
