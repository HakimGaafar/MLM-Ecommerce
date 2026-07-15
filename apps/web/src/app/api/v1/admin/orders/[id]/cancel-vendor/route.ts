import { cancelVendorFromOrder, OrderVendorCancelError } from "@mlm/domain";
import { OrderVendorCancelSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function POST(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = OrderVendorCancelSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const cancellation = await cancelVendorFromOrder({
      orderId: id,
      vendorId: parsed.data.vendorId,
      reason: parsed.data.reason,
      createdByUserId: auth.userId,
    });
    return NextResponse.json({ cancellation }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof OrderVendorCancelError) {
      const status =
        e.code === "NOT_FOUND"
          ? 404
          : e.code === "STRIPE_REFUND_FAILED"
            ? 502
            : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
