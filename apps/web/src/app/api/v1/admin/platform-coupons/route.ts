import {
  createPlatformCoupon,
  listPlatformCoupons,
  PlatformCouponError,
} from "@mlm/domain";
import { PlatformCouponCreateSchema, PlatformCouponListQuerySchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";
import { publicErrorPayload } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const market = await resolveRequestMarket();
  const query = PlatformCouponListQuerySchema.safeParse({
    tab: request.nextUrl.searchParams.get("tab") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });
  const result = await listPlatformCoupons({
    marketId: market.id,
    ...(query.success
      ? { tab: query.data.tab, page: query.data.page, pageSize: query.data.pageSize }
      : {}),
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const market = await resolveRequestMarket();
  const raw = await request.json().catch(() => null);
  const parsed = PlatformCouponCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const coupon = await createPlatformCoupon(market.id, parsed.data);
    return NextResponse.json({ coupon }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof PlatformCouponError) {
      const status = e.code === "DUPLICATE_CODE" || e.code === "MARKET_NOT_FOUND" ? 409 : 400;
      return NextResponse.json(publicErrorPayload(e, { context: "api", code: e.code }), { status });
    }
    throw e;
  }
}
