import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getKycStorageConfig } from "./config";

function s3Client(config: Extract<ReturnType<typeof getKycStorageConfig>, { provider: "s3" }>) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
        : undefined,
  });
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body || typeof body !== "object") return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Local KYC path. Default uses literal segments so Turbopack NFT stays scoped.
 * Absolute KYC_LOCAL_DIR overrides are supported; relative custom dirs fall back to default.
 */
function localKycPath(baseDir: string, filename: string): string {
  if (path.isAbsolute(baseDir)) {
    return path.join(baseDir, filename);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "kyc-documents", filename);
}

export async function storeKycDocument(params: {
  subjectKey: string;
  buffer: Buffer;
  contentType: string;
  extension: string;
}): Promise<{ storageKey: string }> {
  const config = getKycStorageConfig();
  const filename = `${params.subjectKey.replace(/:/g, "_")}-${randomUUID()}.${params.extension}`;

  if (config.provider === "s3") {
    const storageKey = `${config.keyPrefix}/${filename}`;
    await s3Client(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        Body: params.buffer,
        ContentType: params.contentType,
        CacheControl: "private, no-store",
      }),
    );
    return { storageKey };
  }

  const storageKey = path.posix.join("kyc-documents", filename);
  const fullPath = localKycPath(config.baseDir, filename);
  const dir = path.dirname(fullPath);
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ fullPath, params.buffer);
  return { storageKey };
}

export async function readKycDocument(storageKey: string): Promise<Buffer | null> {
  const config = getKycStorageConfig();

  if (config.provider === "s3") {
    try {
      const res = await s3Client(config).send(
        new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }),
      );
      return streamToBuffer(res.Body);
    } catch {
      return null;
    }
  }

  const filename = path.basename(storageKey);
  const fullPath = localKycPath(config.baseDir, filename);
  try {
    return await readFile(/*turbopackIgnore: true*/ fullPath);
  } catch {
    return null;
  }
}

export async function deleteKycDocument(storageKey: string): Promise<void> {
  const config = getKycStorageConfig();

  if (config.provider === "s3") {
    try {
      await s3Client(config).send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }),
      );
    } catch {
      // Best-effort cleanup; DB row is already removed.
    }
    return;
  }

  const filename = path.basename(storageKey);
  const fullPath = localKycPath(config.baseDir, filename);
  try {
    await unlink(/*turbopackIgnore: true*/ fullPath);
  } catch {
    // File may already be gone.
  }
}
