import { OrderInvoiceError } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { ensureCommissionInvoicePdf, invoiceErrorStatus } from "@/lib/invoices/ensure-invoice-pdf";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string; vendorId: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, vendorId } = await context.params;

  try {
    const { buffer, filename } = await ensureCommissionInvoicePdf(id, vendorId, auth.userId);
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
