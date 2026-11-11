import type { PolicyDocument } from "../types";

const en: PolicyDocument = {
  documentType: "MERCHANT_COOPERATION",
  locale: "en",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "This Cooperation Contract sets out the relationship between the Merchant and the VANDSOQ platform (acting through the Representative Company named in the market annex). By accepting this document you agree to sell on the platform under these terms.",
      ],
    },
    {
      id: "roles",
      heading: "1. Roles",
      paragraphs: [
        "The Merchant is the seller of the listed goods and remains responsible for quality, safety, conformity, and after-sales obligations. The platform provides the marketplace, payments collection (where applicable), and customer-facing policies. In the International market the Representative Company may sell to the Customer and settle with the Merchant under the invoicing rules for that market pair.",
      ],
    },
    {
      id: "registration",
      heading: "2. Registration and authority",
      paragraphs: [
        "You confirm that the information provided at onboarding is accurate, that you are authorised to bind the Merchant, and that you will keep KYC and store details up to date. The account remains inactive until all required policies are accepted and store approval is granted.",
      ],
    },
    {
      id: "listings",
      heading: "3. Listings and fulfilment",
      paragraphs: [
        "Listings must be truthful and lawful. You fulfil orders according to the stock location and fulfilment mode you select (merchant direct or VANDSOQ warehouse where available). Cross-market and International sales follow the settlement and invoicing rules published for each seller×buyer market pair.",
      ],
    },
    {
      id: "termination",
      heading: "4. Suspension and termination",
      paragraphs: [
        "The platform may suspend or terminate access for policy breaches, fraud risk, or prolonged non-performance. Outstanding orders, returns, and commission debts remain payable after suspension.",
      ],
    },
  ],
};

const ar: PolicyDocument = {
  documentType: "MERCHANT_COOPERATION",
  locale: "ar",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "يحدد عقد التعاون هذا العلاقة بين التاجر ومنصة VANDSOQ (عبر الشركة الممثلة المذكورة في ملحق السوق). بقبولك هذه الوثيقة توافق على البيع عبر المنصة وفق هذه الشروط.",
      ],
    },
    {
      id: "roles",
      heading: "1. الأدوار",
      paragraphs: [
        "التاجر هو بائع السلع المدرجة ويتحمل مسؤولية الجودة والسلامة والمطابقة وما بعد البيع. توفر المنصة السوق وتحصيل المدفوعات (حيث ينطبق) والسياسات المواجهة للعملاء. في السوق الدولي قد تبيع الشركة الممثلة للعميل وتسوّي مع التاجر وفق قواعد الفوترة لزوج الأسواق.",
      ],
    },
    {
      id: "registration",
      heading: "2. التسجيل والصلاحية",
      paragraphs: [
        "تؤكد أن بيانات التسجيل دقيقة وأنك مخوّل بإلزام التاجر، وأنك ستحدّث بيانات التحقق والمتجر. يبقى الحساب غير نشط حتى قبول جميع السياسات المطلوبة واعتماد المتجر.",
      ],
    },
    {
      id: "listings",
      heading: "3. الإدراج والتنفيذ",
      paragraphs: [
        "يجب أن تكون الإدراجات صادقة ومشروعة. تنفّذ الطلبات وفق موقع المخزون ووضع التنفيذ الذي تختاره. تتبع المبيعات عبر الأسواق والدولية قواعد التسوية والفوترة لكل زوج بائع×مشتري.",
      ],
    },
    {
      id: "termination",
      heading: "4. الإيقاف والإنهاء",
      paragraphs: [
        "يجوز للمنصة إيقاف أو إنهاء الوصول عند مخالفة السياسات أو مخاطر الاحتيال أو التقصير المستمر. تبقى الطلبات والمرتجعات وديون العمولة قائمة بعد الإيقاف.",
      ],
    },
  ],
};

export const merchantCooperationPolicy = { en, ar };
