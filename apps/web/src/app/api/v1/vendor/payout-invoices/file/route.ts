import { prisma } from "@mlm/db";
import { isVendorPayoutInvoiceStorageKey } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import {
  contentTypeForPayoutKey,
  readPayoutInvoiceFile,
} from "@/lib/payout-invoice-storage";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

/** Authenticated download of this vendor's payout invoice file. */
export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized || !auth.vendorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const denied = await requireVendorPermission(auth, "vendor:wallet:read");
  if (denied) return denied;

  const key = request.nextUrl.searchParams.get("key")?.trim() ?? "";
  if (!isVendorPayoutInvoiceStorageKey(key, auth.vendorId)) {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
  }

  const owned = await prisma.vendorPayoutInvoice.findFirst({
    where: { vendorId: auth.vendorId, fileStorageKey: key },
    select: { id: true },
  });
  // Allow download of freshly uploaded keys not yet linked to an invoice row.
  if (!owned) {
    // Still restrict path to this vendorId via isVendorPayoutInvoiceStorageKey.
  }

  const buffer = await readPayoutInvoiceFile(key);
  if (!buffer) return NextResponse.json({ error: "File not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentTypeForPayoutKey(key),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${key.split("/").pop() ?? "invoice"}"`,
    },
  });
}
