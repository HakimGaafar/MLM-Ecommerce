import { getStripeClient, handleStripeWebhookEvent } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const body = await request.text();
  let event: { id: string; type: string; data: { object: { id?: string; metadata?: Record<string, string> } } };
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await handleStripeWebhookEvent(event);
    if (result.duplicate) {
      logger.info({ eventId: event.id, type: event.type }, "stripe webhook duplicate ignored");
      return NextResponse.json({ received: true, duplicate: true });
    }
    logger.info({ eventId: event.id, type: event.type }, "stripe webhook processed");
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error({ err: error, eventId: event.id, type: event.type }, "stripe webhook handler failed");
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
