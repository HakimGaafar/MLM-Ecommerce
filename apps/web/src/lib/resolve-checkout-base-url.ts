import type { NextRequest } from "next/server";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Stripe success/cancel URLs should return the shopper to the site they used
 * (localhost in dev, deployed host in production). APP_BASE_URL remains the
 * canonical production URL for emails and links.
 */
export function resolveCheckoutBaseUrl(request: NextRequest): string {
  const configured = normalizeBaseUrl(process.env.APP_BASE_URL ?? "http://localhost:3000");
  const requestOrigin = normalizeBaseUrl(request.nextUrl.origin);

  try {
    const requestHost = new URL(requestOrigin).hostname;
    if (isLocalHostname(requestHost)) {
      return requestOrigin;
    }

    const configuredHost = new URL(configured).hostname;
    if (requestHost === configuredHost) {
      return requestOrigin;
    }
  } catch {
    // fall through to configured
  }

  return configured;
}
