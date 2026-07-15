export type InvoicePdfLocale = "en" | "ar";

export type InvoicePdfLabels = {
  taxInvoice: string;
  commissionInvoice: string;
  invoiceNo: string;
  date: string;
  order: string;
  relatedOrder: string;
  seller: string;
  billTo: string;
  fromPlatform: string;
  toVendor: string;
  unit: string;
  product: string;
  qty: string;
  unitPrice: string;
  lineTotal: string;
  subtotal: string;
  discount: string;
  shipping: string;
  vat: string;
  total: string;
  platformCommission: string;
  totalDue: string;
  vatTrn: string;
  footerTax: (seller: string) => string;
  footerTaxSimple: string;
  footerMarketplace: string;
  footerCommission: (platform: string) => string;
  footerCommissionSimple: string;
  forseiz: string;
};

const EN: InvoicePdfLabels = {
  taxInvoice: "Tax Invoice",
  commissionInvoice: "Commission Invoice",
  invoiceNo: "Invoice No",
  date: "Date",
  order: "Order",
  relatedOrder: "Related order",
  seller: "Seller",
  billTo: "Bill to",
  fromPlatform: "From (Platform)",
  toVendor: "To (Vendor)",
  unit: "Unit",
  product: "Product",
  qty: "Qty",
  unitPrice: "Unit price",
  lineTotal: "Line total",
  subtotal: "Subtotal",
  discount: "Discount",
  shipping: "Shipping",
  vat: "VAT (15%)",
  total: "Total",
  platformCommission: "Platform commission",
  totalDue: "Total due",
  vatTrn: "VAT TRN",
  footerTax: (seller) => `Tax invoice issued by ${seller}. Retain for your records.`,
  footerTaxSimple: "Tax invoice. Retain for your records.",
  footerMarketplace: "Issued via Fources Marketplace",
  footerCommission: (platform) => `Commission invoice from ${platform}. Retain for your records.`,
  footerCommissionSimple: "Commission invoice. Retain for your records.",
  forseiz: "FORSEIZ",
};

const AR: InvoicePdfLabels = {
  taxInvoice: "فاتورة ضريبية",
  commissionInvoice: "فاتورة عمولة",
  invoiceNo: "رقم الفاتورة",
  date: "التاريخ",
  order: "الطلب",
  relatedOrder: "الطلب المرتبط",
  seller: "البائع",
  billTo: "العميل",
  fromPlatform: "المنصة",
  toVendor: "التاجر",
  unit: "الوحدة",
  product: "المنتج",
  qty: "الكمية",
  unitPrice: "سعر الوحدة",
  lineTotal: "إجمالي البند",
  subtotal: "المجموع الفرعي",
  discount: "الخصم",
  shipping: "الشحن",
  vat: "ضريبة القيمة المضافة",
  total: "الإجمالي",
  platformCommission: "عمولة المنصة",
  totalDue: "المبلغ المستحق",
  vatTrn: "الرقم الضريبي",
  footerTax: (seller) => `فاتورة ضريبية صادرة من ${seller}. احتفظ بها لسجلاتك.`,
  footerTaxSimple: "فاتورة ضريبية. احتفظ بها لسجلاتك.",
  footerMarketplace: "صادرة عبر منصة فورسيز",
  footerCommission: (platform) => `فاتورة عمولة من ${platform}. احتفظ بها لسجلاتك.`,
  footerCommissionSimple: "فاتورة عمولة. احتفظ بها لسجلاتك.",
  forseiz: "فورسيز",
};

export function getInvoicePdfLabels(locale: InvoicePdfLocale): InvoicePdfLabels {
  return locale === "ar" ? AR : EN;
}

export function normalizeInvoicePdfLocale(value: string | null | undefined): InvoicePdfLocale {
  return value === "ar" ? "ar" : "en";
}
