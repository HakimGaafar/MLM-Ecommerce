import { createHmac, timingSafeEqual } from "node:crypto";
import { formatTapAmount, getTapSecretKey } from "./tap-client";

/**
 * Tap webhook hashstring (HMAC-SHA256 of concatenated x_* fields with secret API key).
 * @see https://developers.tap.company/docs/webhook
 */
export function buildTapHashString(params: {
  id: string;
  amount: number | string;
  currency: string;
  gatewayReference?: string | null;
  paymentReference?: string | null;
  status: string;
  created: string | number;
}): string {
  const amount = formatTapAmount(params.amount, params.currency);
  return (
    `x_id${params.id}` +
    `x_amount${amount}` +
    `x_currency${params.currency.toUpperCase()}` +
    `x_gateway_reference${params.gatewayReference ?? ""}` +
    `x_payment_reference${params.paymentReference ?? ""}` +
    `x_status${params.status}` +
    `x_created${params.created}`
  );
}

export function computeTapHashstring(toBeHashed: string, secretKey = getTapSecretKey()): string {
  return createHmac("sha256", secretKey).update(toBeHashed, "utf8").digest("hex");
}

export function verifyTapHashstring(
  postedHash: string | null | undefined,
  params: Parameters<typeof buildTapHashString>[0],
): boolean {
  if (!postedHash?.trim()) return false;
  const expected = computeTapHashstring(buildTapHashString(params));
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(postedHash.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
