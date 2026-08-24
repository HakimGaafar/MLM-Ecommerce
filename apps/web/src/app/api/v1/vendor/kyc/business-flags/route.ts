import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateVendorBusinessFlags, vendorHasPhysicalShop } from "@mlm/domain";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

const PatchSchema = z.object({
  hasPhysicalShop: z.boolean(),
});

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:wallet:read");
  if (denied) return denied;

  const hasPhysicalShop = await vendorHasPhysicalShop(auth.vendorId);
  return NextResponse.json({ hasPhysicalShop }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:wallet:edit");
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await updateVendorBusinessFlags({
    vendorId: auth.vendorId,
    hasPhysicalShop: parsed.data.hasPhysicalShop,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
