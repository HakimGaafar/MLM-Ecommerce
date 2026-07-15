/**
 * Boot-time validation for production deployments (Phase XII4).
 * Called from instrumentation.ts on server start.
 */
function isLocalAppBaseUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function validateCredentialPair(
  missing: string[],
  accessKeyName: string,
  secretKeyName: string,
): void {
  const hasAccessKey = Boolean(process.env[accessKeyName]?.trim());
  const hasSecretKey = Boolean(process.env[secretKeyName]?.trim());
  if (hasAccessKey === hasSecretKey) return;
  missing.push(hasAccessKey ? secretKeyName : accessKeyName);
}

export function validateProductionBootEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  const required = ["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "APP_BASE_URL"];
  for (const key of required) {
    if (!process.env[key]?.trim()) missing.push(key);
  }

  if (missing.length > 0) {
    throw new Error(`[boot] Missing required production env: ${missing.join(", ")}`);
  }

  if (
    !process.env.APP_BASE_URL?.startsWith("https://") &&
    !isLocalAppBaseUrl(process.env.APP_BASE_URL ?? "")
  ) {
    throw new Error("[boot] APP_BASE_URL must use https in production.");
  }

  const storage = process.env.STORAGE_PROVIDER ?? "local";
  const storageMissing: string[] = [];
  if (storage === "s3") {
    for (const key of ["S3_BUCKET", "S3_REGION", "CDN_BASE_URL"]) {
      if (!process.env[key]?.trim()) storageMissing.push(key);
    }
    validateCredentialPair(storageMissing, "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY");
  }

  if (storageMissing.length > 0) {
    throw new Error(`[boot] Missing storage env for STORAGE_PROVIDER=s3: ${storageMissing.join(", ")}`);
  }

  const kycStorage = process.env.KYC_STORAGE_PROVIDER ?? storage;
  const kycMissing: string[] = [];
  if (kycStorage === "s3") {
    if (!(process.env.KYC_S3_BUCKET ?? process.env.S3_BUCKET)?.trim()) {
      kycMissing.push("KYC_S3_BUCKET (or S3_BUCKET)");
    }
    if (!(process.env.KYC_S3_REGION ?? process.env.S3_REGION)?.trim()) {
      kycMissing.push("KYC_S3_REGION (or S3_REGION)");
    }

    const kycAccessKey =
      process.env.KYC_AWS_ACCESS_KEY_ID?.trim() ?? process.env.AWS_ACCESS_KEY_ID?.trim();
    const kycSecretKey =
      process.env.KYC_AWS_SECRET_ACCESS_KEY?.trim() ?? process.env.AWS_SECRET_ACCESS_KEY?.trim();
    if (Boolean(kycAccessKey) !== Boolean(kycSecretKey)) {
      kycMissing.push(kycAccessKey ? "KYC_AWS_SECRET_ACCESS_KEY" : "KYC_AWS_ACCESS_KEY_ID");
    }
  }

  if (kycMissing.length > 0) {
    throw new Error(
      `[boot] Missing KYC storage env for KYC_STORAGE_PROVIDER=s3: ${kycMissing.join(", ")}`,
    );
  }
}
