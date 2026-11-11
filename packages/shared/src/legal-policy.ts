/** Legal / policy document types for public pages and merchant registration. */
export const LEGAL_DOCUMENT_TYPES = [
  "ABOUT",
  "TERMS",
  "PRIVACY",
  "RETURNS",
  "SHIPPING",
  "PRICING_PAYMENT",
  "CASHBACK_REFERRAL",
  "MERCHANT_COOPERATION",
  "MERCHANT_OPERATIONAL",
  "MERCHANT_COMMISSION",
  "MERCHANT_DATA_CONFIRMATION",
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const PUBLIC_LEGAL_DOCUMENT_TYPES = [
  "ABOUT",
  "TERMS",
  "PRIVACY",
  "RETURNS",
  "SHIPPING",
  "PRICING_PAYMENT",
  "CASHBACK_REFERRAL",
] as const satisfies readonly LegalDocumentType[];

export const MERCHANT_LEGAL_DOCUMENT_TYPES = [
  "MERCHANT_COOPERATION",
  "MERCHANT_OPERATIONAL",
  "MERCHANT_COMMISSION",
  "MERCHANT_DATA_CONFIRMATION",
  "TERMS",
  "PRIVACY",
  "RETURNS",
  "SHIPPING",
  "PRICING_PAYMENT",
] as const satisfies readonly LegalDocumentType[];

export const LEGAL_DOCUMENT_TITLES: Record<
  LegalDocumentType,
  { en: string; ar: string }
> = {
  ABOUT: { en: "About Us", ar: "من نحن" },
  TERMS: { en: "Terms & Conditions", ar: "الشروط والأحكام" },
  PRIVACY: { en: "Privacy & Data Protection", ar: "الخصوصية وحماية البيانات" },
  RETURNS: { en: "Returns, Cancellation & Exchange", ar: "الاسترجاع والإلغاء والاستبدال" },
  SHIPPING: { en: "Shipping & Delivery", ar: "الشحن والتوصيل" },
  PRICING_PAYMENT: { en: "Pricing & Payment", ar: "الأسعار والدفع" },
  CASHBACK_REFERRAL: { en: "Cashback & Referral", ar: "الكاش باك والإحالة" },
  MERCHANT_COOPERATION: { en: "Cooperation Contract", ar: "عقد التعاون" },
  MERCHANT_OPERATIONAL: { en: "Operational Policies", ar: "السياسات التشغيلية" },
  MERCHANT_COMMISSION: { en: "Commission & Settlement", ar: "العمولات والتسوية" },
  MERCHANT_DATA_CONFIRMATION: {
    en: "Data accuracy & authority to bind",
    ar: "صحة البيانات وصلاحية التوقيع",
  },
};

export const INVOICING_PARTIES = ["MERCHANT", "PLATFORM"] as const;
export type InvoicingParty = (typeof INVOICING_PARTIES)[number];

export const REFUND_FEE_CAUSES = [
  "PRODUCT_DEFECT",
  "MERCHANT_MISTAKE",
  "PLATFORM_MISTAKE",
  "CUSTOMER_CHANGE_OF_MIND",
  "CUSTOMER_REFUSED_DELIVERY",
] as const;

export type RefundFeeCause = (typeof REFUND_FEE_CAUSES)[number];

export const REFUND_FEE_PAYERS = ["MERCHANT", "PLATFORM", "CUSTOMER"] as const;
export type RefundFeePayer = (typeof REFUND_FEE_PAYERS)[number];

/** Client v1 defaults — admin-configurable later. */
export const DEFAULT_REFUND_FEE_PAYERS: Record<RefundFeeCause, RefundFeePayer> = {
  PRODUCT_DEFECT: "MERCHANT",
  MERCHANT_MISTAKE: "MERCHANT",
  PLATFORM_MISTAKE: "PLATFORM",
  CUSTOMER_CHANGE_OF_MIND: "CUSTOMER",
  CUSTOMER_REFUSED_DELIVERY: "CUSTOMER",
};

export const DEFAULT_LEGAL_POLICY_VERSION = "1.0";
