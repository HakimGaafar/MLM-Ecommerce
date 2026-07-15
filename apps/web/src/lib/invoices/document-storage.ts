import { PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStorageConfig } from "../storage/config";

export type StoredDocument = {
  storageKey: string;
  fileUrl: string | null;
};

function localInvoicePath(storageKey: string): string {
  return path.join(process.cwd(), "public", "uploads", storageKey);
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body || typeof body !== "object") return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function storeInvoicePdf(storageKey: string, buffer: Buffer): Promise<StoredDocument> {
  const config = getStorageConfig();

  if (config.provider === "s3") {
    const client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
          : undefined,
    });
    const key = `invoices/${storageKey}`;
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: "application/pdf",
        CacheControl: "private, max-age=31536000, immutable",
      }),
    );
    return { storageKey: key, fileUrl: `${config.cdnBaseUrl}/${key}` };
  }

  const relativeKey = `invoices/${storageKey}`;
  const fullPath = localInvoicePath(relativeKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return { storageKey: relativeKey, fileUrl: `/uploads/${relativeKey}` };
}

export async function readInvoicePdf(storageKey: string): Promise<Buffer | null> {
  const config = getStorageConfig();

  if (config.provider === "s3") {
    const client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
          : undefined,
    });
    try {
      const res = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }),
      );
      return streamToBuffer(res.Body);
    } catch {
      return null;
    }
  }

  try {
    return await readFile(localInvoicePath(storageKey));
  } catch {
    return null;
  }
}
