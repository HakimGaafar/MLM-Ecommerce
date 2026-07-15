/**
 * Boot-time validation for production deployments (Phase XII4).
 * Called from instrumentation.ts on server start.
 */
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

  if (!process.env.APP_BASE_URL?.startsWith("https://")) {
    throw new Error("[boot] APP_BASE_URL must use https in production.");
  }

  const storage = process.env.STORAGE_PROVIDER ?? "local";
  const storageMissing: string[] = [];
  if (storage === "s3") {
    for (const key of ["S3_BUCKET", "CDN_BASE_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
      if (!process.env[key]?.trim()) storageMissing.push(key);
    }
  }

  if (storageMissing.length > 0) {
    throw new Error(`[boot] Missing storage env for STORAGE_PROVIDER=s3: ${storageMissing.join(", ")}`);
  }
}
