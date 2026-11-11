import type { PolicyDocument } from "../types";

const en: PolicyDocument = {
  documentType: "MERCHANT_COMMISSION",
  locale: "en",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "This Commission & Settlement schedule explains how platform fees and invoicing parties work. Exact percentages for each seller×buyer market pair are configurable in admin and are snapshotted on each order.",
      ],
    },
    {
      id: "home",
      heading: "1. Home-market sales",
      paragraphs: [
        "When the Merchant’s primary market matches the buyer’s market, the default is: Merchant invoices the Customer; platform commission is typically 5% (unless an invoicing rule overrides it).",
      ],
    },
    {
      id: "cross",
      heading: "2. Cross-market and International",
      paragraphs: [
        "When the sale is cross-market or International, the default is: the Representative Company (platform) invoices the Customer; the Merchant invoices the platform for supply; platform commission is typically 10% (unless overridden). FX, transfer fees, and customs risk remain as accepted at listing and checkout.",
      ],
    },
    {
      id: "settlement",
      heading: "3. Settlement",
      paragraphs: [
        "Vendor earnings accrue after order completion and payment per the settlement window. COD may create commission debt when the Merchant collects cash. Changing an invoicing rule affects new orders only; existing orders keep their snapshotted party and rate.",
      ],
    },
    {
      id: "changes",
      heading: "4. Changes",
      paragraphs: [
        "The platform may update commission or invoicing rules with notice via the admin configuration and published merchant policies. Continued selling after notice constitutes acceptance of the new schedule for future orders.",
      ],
    },
  ],
};

const ar: PolicyDocument = {
  documentType: "MERCHANT_COMMISSION",
  locale: "ar",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "يوضح جدول العمولات والتسوية كيفية عمل رسوم المنصة وجهة الفوترة. النسب الدقيقة لكل زوج بائع×مشتري قابلة للضبط في الإدارة وتُثبَّت على كل طلب.",
      ],
    },
    {
      id: "home",
      heading: "1. مبيعات السوق المحلي",
      paragraphs: [
        "عندما يطابق السوق الأساسي للتاجر سوق المشتري، الافتراضي: يفوتر التاجر العميل؛ وعمولة المنصة عادة 5٪ (ما لم تُلغَ بقاعدة فوترة).",
      ],
    },
    {
      id: "cross",
      heading: "2. عبر الأسواق والدولي",
      paragraphs: [
        "عند البيع عبر الأسواق أو دولياً، الافتراضي: تفوتر الشركة الممثلة (المنصة) العميل؛ ويفوتر التاجر المنصة للتوريد؛ وعمولة المنصة عادة 10٪. تبقى مخاطر سعر الصرف ورسوم التحويل والجمارك كما قُبلت عند الإدراج والدفع.",
      ],
    },
    {
      id: "settlement",
      heading: "3. التسوية",
      paragraphs: [
        "تُحتسب أرباح التاجر بعد اكتمال الطلب والدفع وفق نافذة التسوية. قد ينشئ الدفع عند الاستلام دين عمولة عند تحصيل التاجر للنقد. تغيير قاعدة الفوترة يؤثر على الطلبات الجديدة فقط.",
      ],
    },
    {
      id: "changes",
      heading: "4. التعديلات",
      paragraphs: [
        "يجوز للمنصة تحديث العمولة أو قواعد الفوترة مع إشعار عبر الإعدادات وسياسات التاجر المنشورة. استمرار البيع بعد الإشعار يُعد قبولاً للجدول الجديد للطلبات القادمة.",
      ],
    },
  ],
};

export const merchantCommissionPolicy = { en, ar };
