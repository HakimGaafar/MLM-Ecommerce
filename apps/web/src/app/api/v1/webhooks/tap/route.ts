import {
  handleTapWebhookCharge,
  verifyTapHashstring,
  type TapChargeResponse,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Tap pay-in async notify (post.url).
 * Requires a valid hashstring header, then finalizes order on CAPTURED.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as TapChargeResponse | null;
  if (!body || typeof body !== "object" || !body.id) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const hashHeader =
    request.headers.get("hashstring") ||
    request.headers.get("Hashstring") ||
    request.headers.get("x-tap-hashstring");

  const ok = verifyTapHashstring(hashHeader, {
    id: body.id,
    amount: body.amount ?? 0,
    currency: body.currency ?? "SAR",
    gatewayReference: body.reference?.gateway ?? "",
    paymentReference: body.reference?.payment ?? "",
    status: body.status ?? "",
    created: body.transaction?.created ?? "",
  });
  if (!ok) {
    return NextResponse.json({ error: "Invalid or missing signature" }, { status: 401 });
  }

  try {
    const result = await handleTapWebhookCharge(body);
    if (result.duplicate) {
      logger.info({ chargeId: body.id, status: body.status }, "tap webhook duplicate ignored");
      return NextResponse.json({ received: true, duplicate: true });
    }
    logger.info(
      { chargeId: body.id, status: body.status, orderId: result.orderId },
      "tap webhook processed",
    );
    return NextResponse.json({ received: true, orderId: result.orderId ?? null });
  } catch (error) {
    logger.error({ err: error, chargeId: body.id, status: body.status }, "tap webhook handler failed");
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
