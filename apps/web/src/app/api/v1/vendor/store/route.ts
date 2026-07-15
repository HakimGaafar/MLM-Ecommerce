import { getVendorStore, updateVendorStore } from "@mlm/domain";
import { VendorStoreUpdateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const readDenied = await requireVendorPermission(auth, "vendor:store:read");
  if (readDenied) return readDenied;

  const store = await getVendorStore(auth.vendorId);
  if (!store) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  return NextResponse.json({ store }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:store:edit");
  if (denied) return denied;

  const raw = await request.json().catch(() => null);
  const parsed = VendorStoreUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const store = await updateVendorStore(auth.vendorId, parsed.data);
  if (!store) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  return NextResponse.json({ store }, { headers: { "Cache-Control": "no-store" } });
}
