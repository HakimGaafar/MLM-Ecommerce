import {
  createOrderReturn,
  CustomerReturnError,
  listCustomerReturns,
} from "@mlm/domain";
import { OrderReturnCreateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const dateRange = url.searchParams.get("dateRange") ?? "all";
  const dateFrom = url.searchParams.get("dateFrom") ?? "";
  const dateTo = url.searchParams.get("dateTo") ?? "";
  const { page, pageSize } = parsePaginationSearchParams(url.searchParams);
  const market = await resolveRequestMarket();

  const result = await listCustomerReturns({
    buyerUserId: auth.userId,
    marketId: market.id,
    statusFilter: status,
    dateRange,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    page,
    pageSize,
  });
  return NextResponse.json(
    {
      ...result,
      filters: {
        status,
        dateRange,
        dateFrom,
        dateTo,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await request.json().catch(() => null);
  const parsed = OrderReturnCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const created = await createOrderReturn(auth.userId, parsed.data);
    return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof CustomerReturnError) {
      const status =
        e.code === "NOT_FOUND"
          ? 404
          : e.code === "FORBIDDEN"
            ? 403
            : e.code === "ORDER_NOT_ELIGIBLE" || e.code === "ACTIVE_RETURN_EXISTS" || e.code === "INVALID_CANCEL"
              ? 409
              : e.code === "RETURN_UNITS_REQUIRED" ||
                  e.code === "RETURN_UNITS_INVALID" ||
                  e.code === "RETURN_UNITS_NOT_RETURNABLE"
                ? 400
                : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
