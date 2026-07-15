import {
  adminSetVendorShipping,
  getAdminVendorShippingDetail,
  VendorShippingError,
} from "@mlm/domain";
import { AdminVendorShippingSetSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const detail = await getAdminVendorShippingDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ shipping: detail }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = AdminVendorShippingSetSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await adminSetVendorShipping(id, auth.userId, parsed.data);
    const shipping = await getAdminVendorShippingDetail(id);
    return NextResponse.json({ shipping }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorShippingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 404 });
    }
    throw e;
  }
}
