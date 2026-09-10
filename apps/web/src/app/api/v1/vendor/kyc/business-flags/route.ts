import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getVendorBusinessFlags, updateVendorBusinessFlags } from "@mlm/domain";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

const PatchSchema = z.object({
  hasPhysicalShop: z.boolean().optional(),
  hasCommercialLicense: z.boolean().optional(),
  licenseTypeCode: z.string().trim().max(64).nullable().optional(),
  licenseTypeOther: z.string().trim().max(120).nullable().optional(),
  ecommerceOnLicense: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:wallet:read");
  if (denied) return denied;

  const flags = await getVendorBusinessFlags(auth.vendorId);
  return NextResponse.json(flags, { headers: { "Cache-Control": "no-store" } });
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
    ...parsed.data,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
