import { updateVendorSetupShipping, VendorShippingError } from "@mlm/domain";
import { VendorSetupShippingSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function PATCH(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:setup:edit");
  if (denied) return denied;

  const raw = await request.json().catch(() => null);
  const parsed = VendorSetupShippingSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const setup = await updateVendorSetupShipping(auth.vendorId, parsed.data);
    if (!setup) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ setup }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorShippingError) {
      const status = e.code === "PENDING_REQUEST_EXISTS" ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
