import type { InvoiceDocumentType } from "@mlm/db";
import {
  buildCommissionInvoiceRender,
  buildVendorSaleInvoiceRender,
  getStoredInvoice,
  logInvoiceDownload,
  OrderInvoiceError,
  saveGeneratedInvoice,
} from "@mlm/domain";
import { readInvoicePdf, storeInvoicePdf } from "./document-storage";
import type { InvoicePdfLocale } from "./invoice-pdf-locale";
import { normalizeInvoicePdfLocale } from "./invoice-pdf-locale";
import { renderCommissionInvoicePdf, renderVendorSaleInvoicePdf } from "./render-pdf";

export type { InvoicePdfLocale };
export { normalizeInvoicePdfLocale };

/** Arabic invoice PDFs disabled until RTL layout is production-ready. */
export const ACTIVE_INVOICE_LOCALE: InvoicePdfLocale = "en";

function storageFileName(invoiceNo: string): string {
  return `${invoiceNo.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
}

function storageKeyFor(invoiceNo: string): string {
  return `invoices/${storageFileName(invoiceNo)}`;
}

export async function ensureVendorSaleInvoicePdf(
  orderId: string,
  vendorId: string,
  userId: string,
  _locale?: InvoicePdfLocale,
): Promise<{ buffer: Buffer; invoiceNo: string; filename: string }> {
  const locale = ACTIVE_INVOICE_LOCALE;
  const existing = await getStoredInvoice(orderId, vendorId, "VENDOR_SALE");
  if (existing) {
    const key = storageKeyFor(existing.invoiceNo);
    const buffer = await readInvoicePdf(key);
    if (buffer) {
      await logInvoiceDownload(existing.id, userId);
      return { buffer, invoiceNo: existing.invoiceNo, filename: storageFileName(existing.invoiceNo) };
    }
  }

  const render = await buildVendorSaleInvoiceRender(orderId, vendorId);
  const buffer = await renderVendorSaleInvoicePdf(render, locale);
  const fileName = storageFileName(render.invoiceNo);
  const stored = await storeInvoicePdf(fileName, buffer);

  const row =
    existing ??
    (await saveGeneratedInvoice({
      orderId,
      vendorId,
      documentType: "VENDOR_SALE",
      invoiceNo: render.invoiceNo,
      storageKey: stored.storageKey,
      fileUrl: stored.fileUrl,
      subtotal: render.subtotal,
      vatTotal: render.vatTotal,
      totalAmount: render.totalAmount,
    }));

  await logInvoiceDownload(row.id, userId);
  return { buffer, invoiceNo: render.invoiceNo, filename: fileName };
}

export async function ensureCommissionInvoicePdf(
  orderId: string,
  vendorId: string,
  userId: string,
  _locale?: InvoicePdfLocale,
): Promise<{ buffer: Buffer; invoiceNo: string; filename: string }> {
  const locale = ACTIVE_INVOICE_LOCALE;
  const existing = await getStoredInvoice(orderId, vendorId, "COMMISSION");
  if (existing) {
    const key = storageKeyFor(existing.invoiceNo);
    const buffer = await readInvoicePdf(key);
    if (buffer) {
      await logInvoiceDownload(existing.id, userId);
      return { buffer, invoiceNo: existing.invoiceNo, filename: storageFileName(existing.invoiceNo) };
    }
  }

  const render = await buildCommissionInvoiceRender(orderId, vendorId);
  const buffer = await renderCommissionInvoicePdf(render, locale);
  const fileName = storageFileName(render.invoiceNo);
  const stored = await storeInvoicePdf(fileName, buffer);

  const row =
    existing ??
    (await saveGeneratedInvoice({
      orderId,
      vendorId,
      documentType: "COMMISSION",
      invoiceNo: render.invoiceNo,
      storageKey: stored.storageKey,
      fileUrl: stored.fileUrl,
      subtotal: render.commissionSubtotal,
      vatTotal: render.vatTotal,
      totalAmount: render.totalAmount,
    }));

  await logInvoiceDownload(row.id, userId);
  return { buffer, invoiceNo: render.invoiceNo, filename: fileName };
}

export function invoiceErrorStatus(code: OrderInvoiceError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "GATE_CLOSED":
    case "ORDER_NOT_ELIGIBLE":
    case "PROFILE_INCOMPLETE":
      return 409;
    default:
      return 400;
  }
}

export type { InvoiceDocumentType };
