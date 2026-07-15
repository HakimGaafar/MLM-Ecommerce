import { deleteVendorProduct, getVendorProduct, updateVendorProduct, VendorProductError } from "@mlm/domain";
import { VendorProductUpdateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const readDenied = await requireVendorPermission(auth, "vendor:products:read");
  if (readDenied) return readDenied;

  const { id } = await context.params;
  const product = await getVendorProduct(auth.vendorId, id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:products:edit");
  if (denied) return denied;

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = VendorProductUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const product = await updateVendorProduct(auth.vendorId, id, parsed.data);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ product }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorProductError && e.code === "INVALID_CATEGORY") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof VendorProductError && e.code === "PENDING_EDIT_REQUEST_EXISTS") {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    if (e instanceof Error && e.message === "INVALID_STATUS_TRANSITION") {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
    }
    throw e;
  }
}

export async function DELETE(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:products:delete");
  if (denied) return denied;

  const { id } = await context.params;
  try {
    await deleteVendorProduct(auth.vendorId, id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorProductError) {
      const status =
        e.code === "NOT_FOUND" ? 404 : e.code === "HAS_ORDER_HISTORY" ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
