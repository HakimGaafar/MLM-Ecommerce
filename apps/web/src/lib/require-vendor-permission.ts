import { assertVendorPermission, VendorPermissionError } from "@mlm/domain";
import type { VendorPermissionCode } from "@mlm/shared";
import { NextResponse } from "next/server";
import type { VendorSessionAuth } from "@/lib/require-vendor-session";

export async function requireVendorPermission(
  auth: Extract<VendorSessionAuth, { authorized: true }>,
  code: VendorPermissionCode,
): Promise<NextResponse | null> {
  try {
    await assertVendorPermission(auth.vendorId, code, auth.userId);
    return null;
  } catch (e) {
    if (e instanceof VendorPermissionError && e.code === "FORBIDDEN") {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    throw e;
  }
}
