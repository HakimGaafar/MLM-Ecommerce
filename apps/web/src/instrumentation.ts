import { validateProductionBootEnv } from "@/lib/boot-validation";

export async function register() {
  validateProductionBootEnv();

  // Skip during `next build` — DATABASE_URL may be a build placeholder.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureRequiredReferenceData } = await import("@mlm/db");
  await ensureRequiredReferenceData();

  // Sentry: install @sentry/nextjs and set SENTRY_DSN when the client provides an account.
  // See docs/DEPLOYMENT.md — Phase XII5.
}
