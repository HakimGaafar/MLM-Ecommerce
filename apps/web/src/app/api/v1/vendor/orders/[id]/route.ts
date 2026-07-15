import {
  getEffectiveVendorPermissions,
  getVendorOrderDetail,
  OrderFulfillmentGroupError,
  updateVendorOrderLineStatus,
  updateVendorOrderPaymentStatus,
  updateVendorOrderStatus,
  updateVendorFulfillmentGroup,
  VendorOrderError,
} from "@mlm/domain";
import { VendorOrderPatchSchema, vendorHasPermission } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const readDenied = await requireVendorPermission(auth, "vendor:orders:read");
  if (readDenied) return readDenied;

  const { id } = await context.params;
  const market = await resolveRequestMarket();
  const order = await getVendorOrderDetail(auth.vendorId, id, market.id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const permissions = await getEffectiveVendorPermissions(auth.vendorId);
  return NextResponse.json(
    {
      order: {
        ...order,
        canUpdateStatus:
          order.canUpdateStatus && vendorHasPermission(permissions, "vendor:orders:edit"),
        canUpdateFulfillmentGroups:
          order.canUpdateFulfillmentGroups &&
          vendorHasPermission(permissions, "vendor:orders:edit"),
        canUpdatePaymentStatus:
          order.canUpdatePaymentStatus &&
          vendorHasPermission(permissions, "vendor:orders:payment:edit"),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = VendorOrderPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result: {
      status?: string;
      paymentStatus?: string;
      lineItemId?: string;
      lineStatus?: string;
      fulfillmentType?: string;
      fulfillmentStatus?: string;
    } = {};
    if (parsed.data.status !== undefined) {
      const denied = await requireVendorPermission(auth, "vendor:orders:edit");
      if (denied) return denied;
      const statusResult = await updateVendorOrderStatus(auth.vendorId, id, parsed.data.status);
      result.status = statusResult.status;
    }
    if (parsed.data.paymentStatus !== undefined) {
      const denied = await requireVendorPermission(auth, "vendor:orders:payment:edit");
      if (denied) return denied;
      const paymentResult = await updateVendorOrderPaymentStatus(
        auth.vendorId,
        id,
        parsed.data.paymentStatus,
      );
      result.paymentStatus = paymentResult.paymentStatus;
    }
    if (parsed.data.lineStatus !== undefined && parsed.data.lineItemId) {
      const denied = await requireVendorPermission(auth, "vendor:orders:edit");
      if (denied) return denied;
      const lineResult = await updateVendorOrderLineStatus(
        auth.vendorId,
        id,
        parsed.data.lineItemId,
        parsed.data.lineStatus,
      );
      result.lineItemId = lineResult.lineItemId;
      result.lineStatus = lineResult.lineStatus;
    }
    if (parsed.data.fulfillmentStatus !== undefined && parsed.data.fulfillmentType) {
      const denied = await requireVendorPermission(auth, "vendor:orders:edit");
      if (denied) return denied;
      const groupResult = await updateVendorFulfillmentGroup(
        auth.vendorId,
        id,
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
    if (e instanceof VendorOrderError) {
      const status =
        e.code === "NOT_FOUND"
          ? 404
          : e.code === "LINE_NOT_FOUND"
            ? 404
            : e.code === "MULTI_VENDOR"
              ? 409
              : e.code === "FULFILLMENT_GROUP_REQUIRED"
                ? 409
                : e.code === "ORDER_FINALIZED"
                ? 409
                : e.code === "INVALID_TRANSITION"
                  ? 400
                  : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
