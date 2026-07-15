import {
  deleteVendorCoupon,
  getVendorCoupon,
  updateVendorCoupon,
  VendorCouponError,
} from "@mlm/domain";
import { VendorCouponUpdateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const readDenied = await requireVendorPermission(auth, "vendor:coupons:read");
  if (readDenied) return readDenied;

  const { id } = await params;
  const coupon = await getVendorCoupon(auth.vendorId, id);
  if (!coupon) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ coupon }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:coupons:edit");
  if (denied) return denied;

  const raw = await request.json().catch(() => null);
  const parsed = VendorCouponUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  try {
    const coupon = await updateVendorCoupon(auth.vendorId, id, parsed.data);
    return NextResponse.json({ coupon }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorCouponError) {
      const status = e.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:coupons:delete");
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteVendorCoupon(auth.vendorId, id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorCouponError) {
      const status = e.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
