export type StorageProvider = "local" | "s3";

export type LocalStorageConfig = {
  provider: "local";
};

export type S3StorageConfig = {
  provider: "s3";
  bucket: string;
  region: string;
  cdnBaseUrl: string;
  keyPrefix: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Cloudflare R2, MinIO, etc. Omit for AWS S3. */
  endpoint?: string;
  forcePathStyle?: boolean;
};

export type StorageConfig = LocalStorageConfig | S3StorageConfig;

export function getStorageConfig(): StorageConfig {
  const provider = (process.env.STORAGE_PROVIDER ?? "local") as StorageProvider;

  if (provider === "s3") {
    const bucket = process.env.S3_BUCKET?.trim();
    const region = process.env.S3_REGION?.trim();
    const cdnBaseUrl = process.env.CDN_BASE_URL?.trim();

    if (!bucket || !region || !cdnBaseUrl) {
      throw new Error(
        "STORAGE_PROVIDER=s3 requires S3_BUCKET, S3_REGION, and CDN_BASE_URL (e.g. CloudFront URL).",
      );
    }

    const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
    const forcePathStyle =
      process.env.S3_FORCE_PATH_STYLE === "true" ||
      process.env.S3_FORCE_PATH_STYLE === "1";

    return {
      provider: "s3",
      bucket,
      region,
      cdnBaseUrl: cdnBaseUrl.replace(/\/$/, ""),
      keyPrefix: (process.env.S3_KEY_PREFIX ?? "products").replace(/^\/+|\/+$/g, ""),
      accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || undefined,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || undefined,
      endpoint,
      forcePathStyle: endpoint ? forcePathStyle : undefined,
    };
  }

  if (provider !== "local") {
    throw new Error(`Unknown STORAGE_PROVIDER "${provider}". Use "local" or "s3".`);
  }

  return { provider: "local" };
}

/** Hostnames allowed for Next.js Image optimization (from CDN_BASE_URL). */
export function getCdnImageHostnames(): string[] {
  const raw = process.env.CDN_BASE_URL?.trim();
  if (!raw) return [];

  try {
    return [new URL(raw).hostname];
  } catch {
    return [];
  }
}
