import {
  assertCustomerCanAccessVendorSaleInvoice,
  OrderInvoiceError,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { ensureVendorSaleInvoicePdf, invoiceErrorStatus } from "@/lib/invoices/ensure-invoice-pdf";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string; vendorId: string }> }>,
) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, vendorId } = await context.params;

  try {
    await assertCustomerCanAccessVendorSaleInvoice(auth.userId, id, vendorId);
    const { buffer, filename } = await ensureVendorSaleInvoicePdf(id, vendorId, auth.userId);
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
