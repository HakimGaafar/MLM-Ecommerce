import { assertVendorOwnsOrderLine, OrderInvoiceError } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { ensureCommissionInvoicePdf, invoiceErrorStatus } from "@/lib/invoices/ensure-invoice-pdf";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const readDenied = await requireVendorPermission(auth, "vendor:orders:read");
  if (readDenied) return readDenied;

  const { id } = await context.params;

  try {
    await assertVendorOwnsOrderLine(auth.vendorId, id);
    const { buffer, filename } = await ensureCommissionInvoicePdf(id, auth.vendorId, auth.userId);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof OrderInvoiceError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: invoiceErrorStatus(e.code) });
    }
    throw e;
  }
}
