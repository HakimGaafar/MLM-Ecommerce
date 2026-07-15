import type { InvoicePdfLocale } from "./invoice-pdf-locale";
import en from "@/i8n/en.json";
import ar from "@/i8n/ar.json";

export type OrderSummaryPdfLabels = {
  title: string;
  orderNo: string;
  issued: string;
  billTo: string;
  items: string;
  product: string;
  vendor: string;
  qty: string;
  unit: string;
  lineTotal: string;
  subtotal: string;
  shipping: string;
  discount: string;
  vat: string;
  total: string;
  walletApplied: string;
  remainingDue: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentCod: string;
  paymentOnlineCard: string;
  paymentWalletCovered: string;
  paymentPending: string;
  paymentPaid: string;
  paymentFailed: string;
  paymentRefunded: string;
  thankYou: string;
};

export function getOrderSummaryPdfLabels(locale: InvoicePdfLocale): OrderSummaryPdfLabels {
  const inv = locale === "ar" ? ar.customerOrderInvoice : en.customerOrderInvoice;
  const detail = locale === "ar" ? ar.customerOrderDetail : en.customerOrderDetail;

  return {
    title: inv.title,
    orderNo: inv.orderNo,
    issued: inv.issued,
    billTo: inv.billTo,
    items: inv.items,
    product: inv.product,
    vendor: inv.vendor,
    qty: inv.qty,
    unit: inv.unit,
    lineTotal: inv.lineTotal,
    subtotal: inv.subtotal,
    shipping: inv.shipping,
    discount: inv.discount,
    vat: inv.vat,
    total: inv.total,
    walletApplied: inv.walletApplied,
    remainingDue: inv.remainingDue,
    paymentMethod: inv.paymentMethodLabel,
    paymentStatus: inv.paymentStatusLabel,
    paymentCod: detail.paymentCod,
    paymentOnlineCard: detail.paymentOnlineCard,
    paymentWalletCovered: detail.paymentWalletCovered,
    paymentPending: detail.paymentPending,
    paymentPaid: detail.paymentPaid,
    paymentFailed: detail.paymentFailed,
    paymentRefunded: detail.paymentRefunded,
    thankYou: inv.thankYou,
  };
}
