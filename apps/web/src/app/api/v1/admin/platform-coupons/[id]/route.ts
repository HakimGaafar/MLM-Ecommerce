import {
  deletePlatformCoupon,
  PlatformCouponError,
  updatePlatformCoupon,
} from "@mlm/domain";
import { PlatformCouponUpdateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";
import { publicErrorPayload } from "@/lib/api-error-response";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const market = await resolveRequestMarket();
  const raw = await request.json().catch(() => null);
  const parsed = PlatformCouponUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const coupon = await updatePlatformCoupon(market.id, id, parsed.data);
    return NextResponse.json({ coupon }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof PlatformCouponError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json(publicErrorPayload(e, { context: "api", code: e.code }), { status });
    }
    throw e;
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const market = await resolveRequestMarket();

  try {
    await deletePlatformCoupon(market.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof PlatformCouponError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json(publicErrorPayload(e, { context: "api", code: e.code }), { status });
    }
    throw e;
  }
}
