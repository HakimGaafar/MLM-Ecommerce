import {
  AdminReturnError,
  WalletError,
  allowedNextReturnStatuses,
  getAdminReturnDetail,
  updateAdminReturnStatus,
} from "@mlm/domain";
import { OrderReturnAdminStatusSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

function serializeDetail(row: NonNullable<Awaited<ReturnType<typeof getAdminReturnDetail>>>) {
  return {
    id: row.id,
    orderId: row.orderId,
    buyerUserId: row.buyerUserId,
    status: row.status,
    reason: row.reason,
    details: row.details,
    rejectionReason: row.rejectionReason,
    policyAcceptedAt: row.policyAcceptedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    allowedNextStatuses: allowedNextReturnStatuses(row.status),
    order: {
      id: row.order.id,
      orderNo: row.order.orderNo,
      totalAmount: row.order.totalAmount.toString(),
      status: row.order.status,
    },
    buyer: { name: row.buyer.name, email: row.buyer.email },
    units: row.returnUnits.map((u) => ({
      id: u.id,
      unitIndex: u.unitIndex,
      unitLabel: u.unitLabel,
      productName: u.productNameSnapshot,
      lineTotal: u.lineTotal.toString(),
      unitStatus: u.unitStatus,
    })),
  };
}

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid return id" }, { status: 400 });
  }

  const row = await getAdminReturnDetail(id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ detail: serializeDetail(row) }, { headers: { "Cache-Control": "no-store" } });
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
  const parsed = OrderReturnAdminStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await updateAdminReturnStatus(id, parsed.data.status, {
      rejectionReason: parsed.data.rejectionReason,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AdminReturnError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    if (e instanceof WalletError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}
