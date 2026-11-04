import { isTapConfigured } from "./payment-config";

const TAP_API_BASE = (process.env.TAP_API_BASE?.trim() || "https://api.tap.company/v2").replace(
  /\/$/,
  "",
);

/** Decimal places for Tap amount formatting / hashstring (per Tap webhook docs). */
export function tapAmountDecimals(currency: string): number {
  const code = currency.trim().toUpperCase();
  if (code === "OMR" || code === "BHD" || code === "KWD" || code === "JOD") return 3;
  return 2;
}

export function formatTapAmount(amount: number | string, currency: string): string {
  const n = typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid amount for Tap.");
  return n.toFixed(tapAmountDecimals(currency));
}

export function getTapSecretKey(): string {
  const key = process.env.TAP_SECRET_KEY?.trim();
  if (!key) throw new Error("TAP_SECRET_KEY is not configured.");
  return key;
}

export function getTapPublicKey(): string | null {
  return process.env.TAP_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_TAP_PUBLIC_KEY?.trim() || null;
}

export function getTapMerchantId(): string | null {
  return process.env.TAP_MERCHANT_ID?.trim() || null;
}

export function assertTapReady(): void {
  if (!isTapConfigured()) {
    throw new Error("Tap is not configured (TAP_SECRET_KEY).");
  }
}

export type TapChargeResponse = {
  id: string;
  status?: string;
  amount?: number;
  currency?: string;
  transaction?: { url?: string; created?: string | number };
  redirect?: { url?: string };
  reference?: { gateway?: string; payment?: string; transaction?: string; order?: string };
  metadata?: Record<string, string>;
  response?: { code?: string; message?: string };
  errors?: Array<{ code?: string; description?: string }>;
};

export async function tapRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  assertTapReady();
  const url = `${TAP_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${getTapSecretKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as T & {
    errors?: Array<{ description?: string }>;
    message?: string;
  };

  if (!res.ok) {
    const detail =
      json?.errors?.map((e) => e.description).filter(Boolean).join("; ") ||
      json?.message ||
      `Tap API ${res.status}`;
    throw new Error(detail);
  }

  return json as T;
}

export async function createTapCharge(
  payload: Record<string, unknown>,
): Promise<TapChargeResponse> {
  return tapRequest<TapChargeResponse>("POST", "/charges", payload);
}

export async function retrieveTapCharge(chargeId: string): Promise<TapChargeResponse> {
  return tapRequest<TapChargeResponse>("GET", `/charges/${encodeURIComponent(chargeId)}`);
}

export async function createTapRefund(params: {
  chargeId: string;
  amount: number;
  currency: string;
  reason?: string;
}): Promise<{ id: string; status?: string }> {
  return tapRequest("POST", "/refunds", {
    charge_id: params.chargeId,
    amount: Number(formatTapAmount(params.amount, params.currency)),
    currency: params.currency.toUpperCase(),
    reason: params.reason ?? "requested_by_customer",
    post: process.env.TAP_REFUND_POST_URL?.trim()
      ? { url: process.env.TAP_REFUND_POST_URL.trim() }
      : undefined,
  });
}
