import { getPaymentGateway, StripeCheckoutError } from "@mlm/domain";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";

const BodySchema = z.object({
  sessionId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await getPaymentGateway().confirmCheckoutForBuyer(
      auth.userId,
      parsed.data.sessionId,
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StripeCheckoutError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
