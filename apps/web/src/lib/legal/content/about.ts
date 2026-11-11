import type { PolicyDocument } from "../types";

const en: PolicyDocument = {
  documentType: "ABOUT",
  locale: "en",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "VANDSOQ is an online marketplace that brings sellers and buyers together in one place. In this market it is owned and operated by {{legalName}}.",
      ],
    },
    {
      id: "name",
      heading: "What the name means",
      paragraphs: [
        "It comes from our company name, Vision and Development: V stands for Vision, D for Development, and SOQ means market (souq).",
      ],
    },
    {
      id: "offer",
      heading: "What we offer",
      paragraphs: [
        "A multi-vendor platform where licensed merchants list their products and individuals and businesses can buy from several merchants in a single order. We run the platform, secure payment, invoicing, order tracking and return handling.",
      ],
    },
    {
      id: "markets",
      heading: "Our markets",
      paragraphs: [
        "We serve Oman, Saudi Arabia and Egypt, plus an International market. Each market has its own currency, tax treatment and a representative company that issues invoices where required. Available payment and shipping options differ by market and are shown before you place an order.",
      ],
    },
    {
      id: "how-we-work",
      heading: "How we work",
      paragraphs: [
        "The merchant is the seller and is responsible for product quality and for matching the description. VANDSOQ is a technical and organisational intermediary: it collects the order value on the merchant’s behalf and settles the merchant after the return period ends.",
      ],
    },
    {
      id: "values",
      heading: "Our values",
      bullets: [
        "Cooperation: a fair relationship between merchant, customer and platform.",
        "Care: we follow every order until it reaches you.",
        "Clarity: prices, tax and shipping are shown before you pay.",
        "Chance: a real path to growth for merchants and marketers.",
      ],
    },
    {
      id: "company-details",
      heading: "Company details",
      bullets: [
        "Legal name (English): {{legalNameEn}}",
        "Legal name (Arabic): {{legalNameAr}}",
        "Commercial registration: {{commercialRegistration}}",
        "Head office: {{address}}, {{city}}",
        "Email: {{email}}",
        "Phone / WhatsApp: {{phone}}",
        "Website: www.vandsoq.com",
      ],
    },
  ],
};

const ar: PolicyDocument = {
  documentType: "ABOUT",
  locale: "ar",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "فاندسوق (VANDSOQ) سوق إلكتروني يجمع البائعين والمشترين في مكان واحد، وتملكه وتشغّله في هذا السوق {{legalName}}.",
      ],
    },
    {
      id: "name",
      heading: "معنى الاسم",
      paragraphs: [
        "مشتق من اسم شركتنا Vision and Development: الحرفان V وف يرمزان إلى الرؤية، والحرفان D ود إلى التطوير، وكلمة سوق تعني السوق.",
      ],
    },
    {
      id: "offer",
      heading: "ما نقدمه",
      paragraphs: [
        "منصة متعددة التجار: يعرض تجار مرخصون منتجاتهم، ويشتري أفراد وشركات من عدة تجار في طلب واحد. نتولى تشغيل المنصة، والدفع الآمن، وتنظيم الفواتير، وتتبع الطلبات، ومتابعة المرتجعات.",
      ],
    },
    {
      id: "markets",
      heading: "أسواقنا",
      paragraphs: [
        "نخدم أسواق عُمان والسعودية ومصر، إضافة إلى سوق دولي. لكل سوق عملته وضريبته، وشركة ممثلة تصدر الفواتير عند الحاجة. وتختلف وسائل الدفع والشحن المتاحة من سوق إلى آخر، وتظهر لك قبل إتمام الطلب.",
      ],
    },
    {
      id: "how-we-work",
      heading: "كيف نعمل",
      paragraphs: [
        "التاجر هو البائع والمسؤول عن جودة منتجه ومطابقته للوصف. والمنصة وسيط تقني وتنظيمي، تحصّل قيمة الطلب نيابة عن التاجر وتسوّي له مستحقاته بعد انتهاء فترة الإرجاع. بذلك يكون مالك الطلب محميّاً من الطرفين.",
      ],
    },
    {
      id: "values",
      heading: "قيمنا",
      bullets: [
        "تعاون: نبني علاقة رابحة بين التاجر والعميل والمنصة.",
        "رعاية: نتابع الطلب حتى يصل ويرضيك.",
        "شفافية: الأسعار والضريبة والشحن ظاهرة قبل الدفع.",
        "فرصة: نفتح للتجار والمسوّقين باباً حقيقياً للنمو.",
      ],
    },
    {
      id: "company-details",
      heading: "بيانات الشركة",
      bullets: [
        "الاسم القانوني (عربي): {{legalNameAr}}",
        "الاسم القانوني (إنجليزي): {{legalNameEn}}",
        "السجل التجاري: {{commercialRegistration}}",
        "المقر: {{address}}، {{city}}",
        "البريد الإلكتروني: {{email}}",
        "الهاتف / واتساب: {{phone}}",
        "الموقع: www.vandsoq.com",
      ],
    },
  ],
};

export const aboutPolicy = { en, ar };
