import {
  createVendorCoupon,
  listVendorCoupons,
  VendorCouponError,
} from "@mlm/domain";
import { VendorCouponCreateSchema, VendorCouponListQuerySchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const readDenied = await requireVendorPermission(auth, "vendor:coupons:read");
  if (readDenied) return readDenied;

  const query = VendorCouponListQuerySchema.safeParse({
    tab: request.nextUrl.searchParams.get("tab") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });
  const result = await listVendorCoupons(
    auth.vendorId,
    query.success
      ? { tab: query.data.tab, page: query.data.page, pageSize: query.data.pageSize }
      : undefined,
  );
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:coupons:write");
  if (denied) return denied;

  const raw = await request.json().catch(() => null);
  const parsed = VendorCouponCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const coupon = await createVendorCoupon(auth.vendorId, parsed.data);
    return NextResponse.json({ coupon }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorCouponError && e.code === "DUPLICATE_CODE") {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    throw e;
  }
}
