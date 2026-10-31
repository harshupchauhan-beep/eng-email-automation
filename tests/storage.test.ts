import "./setup";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "../src/lib/env";
import { importObjectKey, openImportCsv, putImportCsv, storageDriver } from "../src/lib/storage";

async function streamToString(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("import object storage", () => {
  afterEach(() => {
    delete process.env.STORAGE_DRIVER;
    delete process.env.STORAGE_LOCAL_DIR;
    resetEnvCache();
  });

  it("uses local disk when STORAGE_DRIVER=local", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "eng-mail-storage-"));
    process.env.STORAGE_DRIVER = "local";
    process.env.STORAGE_LOCAL_DIR = dir;
    resetEnvCache();
    expect(storageDriver()).toBe("local");

    const key = await putImportCsv("job-1", Buffer.from("email\nada@example.com\n"));
    expect(key).toBe(importObjectKey("job-1"));
    const stored = await readFile(path.join(dir, key), "utf8");
    expect(stored).toContain("ada@example.com");
    expect(await streamToString(await openImportCsv(key))).toContain("ada@example.com");
  });
});
