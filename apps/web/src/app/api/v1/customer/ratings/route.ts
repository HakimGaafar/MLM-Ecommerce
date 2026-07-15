import { OrderItemRatingUpsertSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { OrderItemRatingError, upsertOrderItemRating } from "@mlm/domain";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await request.json().catch(() => null);
  const parsed = OrderItemRatingUpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await upsertOrderItemRating(auth.userId, parsed.data);
    return NextResponse.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof OrderItemRatingError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 409;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
