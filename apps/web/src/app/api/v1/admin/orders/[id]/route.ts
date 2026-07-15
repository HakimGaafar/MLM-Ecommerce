import {
  AdminOrderError,
  getAdminOrderDetail,
  OrderFulfillmentGroupError,
  updateAdminFulfillmentGroup,
  updateAdminOrderPaymentStatus,
  updateAdminOrderStatus,
} from "@mlm/domain";
import { AdminOrderPatchSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const market = await resolveRequestMarket();
  const order = await getAdminOrderDetail(id, market.id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = AdminOrderPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const market = await resolveRequestMarket();
    const result: {
      status?: string;
      paymentStatus?: string;
      fulfillmentType?: string;
      fulfillmentStatus?: string;
    } = {};
    if (parsed.data.status !== undefined) {
      const statusResult = await updateAdminOrderStatus(id, parsed.data.status, market.id);
      result.status = statusResult.status;
    }
    if (parsed.data.paymentStatus !== undefined) {
      const paymentResult = await updateAdminOrderPaymentStatus(id, parsed.data.paymentStatus, market.id);
      result.paymentStatus = paymentResult.paymentStatus;
    }
    if (
      parsed.data.fulfillmentStatus !== undefined &&
      parsed.data.fulfillmentType &&
      parsed.data.vendorId
    ) {
      const groupResult = await updateAdminFulfillmentGroup(
        id,
        parsed.data.vendorId,
        parsed.data.fulfillmentType,
        parsed.data.fulfillmentStatus,
      );
      result.fulfillmentType = groupResult.fulfillmentType;
      result.fulfillmentStatus = groupResult.fulfillmentStatus;
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof OrderFulfillmentGroupError) {
      const status =
        e.code === "NOT_FOUND"
          ? 404
          : e.code === "FORBIDDEN"
            ? 403
            : e.code === "ORDER_FINALIZED"
              ? 409
              : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    if (e instanceof AdminOrderError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
