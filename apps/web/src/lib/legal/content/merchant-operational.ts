import type { PolicyDocument } from "../types";

const en: PolicyDocument = {
  documentType: "MERCHANT_OPERATIONAL",
  locale: "en",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "These Operational Policies explain day-to-day merchant obligations on VANDSOQ: order handling, shipping, returns cooperation, and service levels.",
      ],
    },
    {
      id: "orders",
      heading: "1. Order handling",
      paragraphs: [
        "Confirm and prepare orders promptly. Keep stock quantities accurate. If you cannot fulfil an item, cancel only through the platform tools and notify support when required.",
      ],
    },
    {
      id: "shipping",
      heading: "2. Shipping and COD",
      paragraphs: [
        "Direct merchant delivery is available only where enabled and, for cash on delivery, only for same-city self-delivery when the platform COD kill-switch is on. Warehouse fulfilment follows VANDSOQ shipping rules for that market.",
      ],
    },
    {
      id: "returns",
      heading: "3. Returns cooperation",
      paragraphs: [
        "You must honour the published Returns policy for your market. Cross-market returns may require hub inspection before accept/reject. Refund fee payers follow the configurable refund-fee matrix.",
      ],
    },
    {
      id: "conduct",
      heading: "4. Conduct",
      paragraphs: [
        "No fake reviews, price manipulation, prohibited goods, or abuse of customer data. Breaches may lead to listing removal, holds on settlement, or account termination.",
      ],
    },
  ],
};

const ar: PolicyDocument = {
  documentType: "MERCHANT_OPERATIONAL",
  locale: "ar",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "توضح هذه السياسات التشغيلية التزامات التاجر اليومية على VANDSOQ: معالجة الطلبات والشحن والتعاون في المرتجعات ومستويات الخدمة.",
      ],
    },
    {
      id: "orders",
      heading: "1. معالجة الطلبات",
      paragraphs: [
        "أكد الطلبات وجهّزها بسرعة. حافظ على دقة الكميات. إذا تعذّر التنفيذ فألغِ عبر أدوات المنصة فقط وأبلغ الدعم عند الحاجة.",
      ],
    },
    {
      id: "shipping",
      heading: "2. الشحن والدفع عند الاستلام",
      paragraphs: [
        "التوصيل المباشر من التاجر متاح حيث يُفعَّل، وللدفع عند الاستلام فقط داخل نفس المدينة مع التوصيل الذاتي عندما يكون مفتاح COD مفعّلاً. يتبع تنفيذ المستودع قواعد شحن VANDSOQ لذلك السوق.",
      ],
    },
    {
      id: "returns",
      heading: "3. التعاون في المرتجعات",
      paragraphs: [
        "يجب احترام سياسة الاسترجاع المنشورة لسوقك. قد تتطلب المرتجعات عبر الأسواق فحصاً في المركز قبل القبول/الرفض. يتبع دافعو رسوم الاسترجاع مصفوفة الرسوم القابلة للضبط.",
      ],
    },
    {
      id: "conduct",
      heading: "4. السلوك",
      paragraphs: [
        "يُحظر التلاعب بالتقييمات أو الأسعار أو السلع المحظورة أو إساءة بيانات العملاء. قد تؤدي المخالفات لإزالة الإدراج أو حجز التسوية أو إنهاء الحساب.",
      ],
    },
  ],
};

export const merchantOperationalPolicy = { en, ar };
