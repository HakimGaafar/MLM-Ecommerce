export type KycStorageProvider = "local" | "s3";

export type KycLocalStorageConfig = {
  provider: "local";
  baseDir: string;
};

export type KycS3StorageConfig = {
  provider: "s3";
  bucket: string;
  region: string;
  keyPrefix: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
};

export type KycStorageConfig = KycLocalStorageConfig | KycS3StorageConfig;

export function getKycStorageConfig(): KycStorageConfig {
  const provider = (process.env.KYC_STORAGE_PROVIDER ??
    process.env.STORAGE_PROVIDER ??
    "local") as KycStorageProvider;

  if (provider === "s3") {
    const bucket = (process.env.KYC_S3_BUCKET ?? process.env.S3_BUCKET)?.trim();
    const region = (process.env.KYC_S3_REGION ?? process.env.S3_REGION)?.trim();
    const keyPrefix = (process.env.KYC_S3_KEY_PREFIX ?? "kyc-documents").replace(/^\/+|\/+$/g, "");

    if (!bucket || !region) {
      throw new Error("KYC_STORAGE_PROVIDER=s3 requires KYC_S3_BUCKET (or S3_BUCKET) and KYC_S3_REGION (or S3_REGION).");
    }

    const endpoint = (process.env.KYC_S3_ENDPOINT ?? process.env.S3_ENDPOINT)?.trim() || undefined;
    const forcePathStyle =
      process.env.KYC_S3_FORCE_PATH_STYLE === "true" ||
      process.env.KYC_S3_FORCE_PATH_STYLE === "1" ||
      process.env.S3_FORCE_PATH_STYLE === "true" ||
      process.env.S3_FORCE_PATH_STYLE === "1";

    return {
      provider: "s3",
      bucket,
      region,
      keyPrefix,
      accessKeyId: (process.env.KYC_AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID)?.trim() || undefined,
      secretAccessKey:
        (process.env.KYC_AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY)?.trim() || undefined,
      endpoint,
      forcePathStyle: endpoint ? forcePathStyle : undefined,
    };
  }

  if (provider !== "local") {
    throw new Error(`Unknown KYC_STORAGE_PROVIDER "${provider}". Use "local" or "s3".`);
  }

  const baseDir = (process.env.KYC_LOCAL_DIR ?? "storage/kyc-documents").trim();
  return { provider: "local", baseDir };
}
