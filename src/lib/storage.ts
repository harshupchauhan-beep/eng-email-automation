import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "./env";

export function importObjectKey(jobId: string) {
  return `imports/${jobId}.csv`;
}

function localRoot() {
  const env = getEnv();
  return env.STORAGE_LOCAL_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");
}

function hasR2Config() {
  const env = getEnv();
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
}

export function storageDriver() {
  const env = getEnv();
  if (env.STORAGE_DRIVER === "r2") return "r2" as const;
  if (env.STORAGE_DRIVER === "local") return "local" as const;
  if (env.NODE_ENV === "production" || hasR2Config()) return "r2" as const;
  return "local" as const;
}

function r2Client() {
  const env = getEnv();
  if (!hasR2Config()) {
    throw new Error("R2 storage is selected but R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET are required");
  }
  return new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function putImportCsv(jobId: string, bytes: Buffer) {
  const key = importObjectKey(jobId);
  const driver = storageDriver();
  if (driver === "r2") {
    const env = getEnv();
    await r2Client().send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: "text/csv",
      }),
    );
    return key;
  }
  const filePath = path.join(localRoot(), key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  return key;
}

export async function openImportCsv(storedPath: string) {
  if (path.isAbsolute(storedPath) || storedPath.includes("\\") || storedPath.startsWith("uploads")) {
    return createReadStream(storedPath);
  }
  if (storageDriver() === "r2") {
    const env = getEnv();
    const response = await r2Client().send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: storedPath,
      }),
    );
    const body = response.Body;
    if (!body) throw new Error(`R2 object ${storedPath} had no body`);
    if (body instanceof Readable) return body;
    const webStream = body.transformToWebStream();
    return Readable.fromWeb(webStream as unknown as import("node:stream/web").ReadableStream);
  }
  return createReadStream(/*turbopackIgnore: true*/ path.join(localRoot(), storedPath));
}
