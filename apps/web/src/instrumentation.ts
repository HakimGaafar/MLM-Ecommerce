import { validateProductionBootEnv } from "@/lib/boot-validation";

export async function register() {
  validateProductionBootEnv();
  // Sentry: install @sentry/nextjs and set SENTRY_DSN when the client provides an account.
  // See docs/DEPLOYMENT.md — Phase XII5.
}
