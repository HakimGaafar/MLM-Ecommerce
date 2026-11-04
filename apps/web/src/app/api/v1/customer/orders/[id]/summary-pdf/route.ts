import { getCustomerOrderForBuyer } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_INVOICE_LOCALE } from "@/lib/invoices/ensure-invoice-pdf";
import { getOrderSummaryPdfLabels } from "@/lib/invoices/order-summary-pdf-labels";
import { renderOrderSummaryPdf } from "@/lib/invoices/render-order-summary-pdf";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

function summaryFilename(orderNo: string): string {
  return `order-summary-${orderNo.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
}

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const market = await resolveRequestMarket();
  const order = await getCustomerOrderForBuyer(auth.userId, id, market.id, market.defaultCurrency);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // DEV-009: order summary is available immediately after the order is placed (not a tax invoice).
  if (order.status === "CANCELLED" || !order.orderSummaryAvailable) {
    return NextResponse.json({ error: "Order summary is not available for this order." }, { status: 403 });
  }

  const locale = ACTIVE_INVOICE_LOCALE;
  const labels = getOrderSummaryPdfLabels(locale);
  const buffer = await renderOrderSummaryPdf(order, labels, locale);
  const filename = summaryFilename(order.orderNo);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
