export class TurnstileError extends Error {
  constructor(
    public readonly code: "NOT_CONFIGURED" | "FAILED" | "MISSING_TOKEN",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "TurnstileError";
  }
}

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

/** Verify Cloudflare Turnstile token. Skips verification only when secret is unset (local/dev). */
export async function verifyTurnstileToken(params: {
  token: string | null | undefined;
  remoteIp?: string | null;
}): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new TurnstileError("NOT_CONFIGURED", "Turnstile is not configured.");
    }
    return;
  }

  const token = params.token?.trim();
  if (!token) {
    throw new TurnstileError("MISSING_TOKEN", "Captcha verification is required.");
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (params.remoteIp?.trim()) body.set("remoteip", params.remoteIp.trim());

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
  if (!json?.success) {
    throw new TurnstileError("FAILED", "Captcha verification failed. Please try again.");
  }
}
