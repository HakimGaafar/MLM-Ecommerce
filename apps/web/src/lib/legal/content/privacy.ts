import type { PolicyDocument } from "../types";

const en: PolicyDocument = {
  documentType: "PRIVACY",
  locale: "en",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "VANDSOQ is committed to protecting users’ privacy and personal data in accordance with the laws of the Sultanate of Oman, and with data protection rules in the countries where we serve customers. By using the website you agree to these practices.",
      ],
    },
    {
      id: "collect",
      heading: "1. Information we collect",
      bullets: [
        "Customers: name, phone number, email, shipping and billing addresses, and order history.",
        "Business customers: company name, tax number, commercial registration number and head-office address, used to issue the invoice.",
        "Merchants: registration or licence details, authorised person’s identification, bank account, and VAT registration status and number.",
        "Payment information: we do not store card details; they are processed by the licensed payment gateway (which may differ by market).",
        "Website usage data: pages visited, access times and device type.",
        "User-submitted content: product reviews and inquiries.",
      ],
    },
    {
      id: "use",
      heading: "2. How we use it",
      paragraphs: [
        "To process orders, deliver services and issue invoices; to settle merchants; to improve the shopping experience; to contact you about orders and offers; to prevent fraud; and to meet legal, accounting and tax requirements.",
      ],
    },
    {
      id: "sharing",
      heading: "3. Sharing",
      paragraphs: [
        "We do not sell or trade customer data. We share it only when necessary with: the selling Merchant to fulfil your order; shipping and delivery companies; the payment gateway; the Representative Company of the relevant market to issue invoices; technical service providers; and legal authorities when lawfully required. Data may move between the countries in which the platform operates, only as far as needed to fulfil the order.",
      ],
    },
    {
      id: "protection",
      heading: "4. Data protection",
      paragraphs: [
        "The platform applies reasonable administrative and technical measures: encrypted connections (SSL), protection against intrusion, and access limited to authorised staff.",
      ],
    },
    {
      id: "retention",
      heading: "5. Retention",
      paragraphs: [
        "We keep data for as long as needed to fulfil orders and meet accounting, tax and legal obligations, then delete or anonymise it.",
      ],
    },
    {
      id: "cookies",
      heading: "6. Cookies",
      paragraphs: [
        "We use cookies to improve performance, remember preferences and analyse usage. You can disable them in your browser settings at any time.",
      ],
    },
    {
      id: "rights",
      heading: "7. Your rights",
      paragraphs: [
        "You may request a copy of your data, correct it, or request its deletion, subject to legal, financial and tax obligations.",
      ],
    },
    {
      id: "updates",
      heading: "8. Updates",
      paragraphs: ["We may update this policy periodically; the latest version is published on the website."],
    },
    {
      id: "contact",
      heading: "9. Contact",
      paragraphs: ["For privacy questions: {{email}} · {{phone}}."],
    },
  ],
};

const ar: PolicyDocument = {
  documentType: "PRIVACY",
  locale: "ar",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "تلتزم فاندسوق بحماية خصوصية المستخدمين وبياناتهم الشخصية وفق القوانين المعمول بها في سلطنة عُمان، ومراعاة أنظمة حماية البيانات في الدول التي نخدم عملاءنا فيها. باستخدامك الموقع توافق على هذه الممارسات.",
      ],
    },
    {
      id: "collect",
      heading: "1. المعلومات التي نجمعها",
      bullets: [
        "العملاء: الاسم، رقم الهاتف، البريد الإلكتروني، عناوين الشحن والفواتير، وسجل الطلبات.",
        "العملاء من الشركات: اسم الشركة ورقمها الضريبي ورقم السجل التجاري وعنوان المقر، لإصدار الفاتورة.",
        "التجار: بيانات السجل أو الترخيص، هوية المفوّض، الحساب البنكي، وحالة التسجيل في ضريبة القيمة المضافة ورقمها.",
        "معلومات الدفع: لا نخزّن بيانات البطاقات، وتتم معالجتها لدى بوابة الدفع المرخصة (تختلف حسب السوق).",
        "بيانات استخدام الموقع: الصفحات المزارة، الأوقات، نوع الجهاز.",
        "ما يقدمه المستخدم من محتوى: تقييمات المنتجات والاستفسارات.",
      ],
    },
    {
      id: "use",
      heading: "2. كيف نستخدم المعلومات",
      paragraphs: [
        "لمعالجة الطلبات وتقديم الخدمات وإصدار الفواتير، وتسوية مستحقات التجار، وتحسين تجربة التسوق، والتواصل معك بخصوص الطلبات والعروض، ومنع الاحتيال، والالتزام بالمتطلبات القانونية والمحاسبية والضريبية.",
      ],
    },
    {
      id: "sharing",
      heading: "3. مشاركة البيانات",
      paragraphs: [
        "لا نبيع بيانات العملاء ولا نتاجر بها. ونشاركها عند الضرورة فقط مع: التاجر البائع لتنفيذ طلبك، شركات الشحن والتوصيل، بوابة الدفع، الشركة الممثلة للسوق المعني لإصدار الفواتير، مزودي الخدمات التقنية، والجهات القانونية عند الطلب النظامي. قد تُنقل البيانات بين الدول التي تعمل فيها المنصة بالقدر اللازم لتنفيذ الطلب.",
      ],
    },
    {
      id: "protection",
      heading: "4. حماية المعلومات",
      paragraphs: [
        "تلتزم المنصة بالإجراءات التنظيمية والتقنية المعقولة لحماية البيانات: تشفير الاتصال (SSL)، أنظمة حماية من الاختراق، ووصول محدود للموظفين المصرح لهم فقط.",
      ],
    },
    {
      id: "retention",
      heading: "5. مدة الاحتفاظ",
      paragraphs: [
        "نحتفظ بالبيانات للمدة اللازمة لتنفيذ الطلبات وللالتزامات المحاسبية والضريبية والقانونية، ثم نحذفها أو نجهّل هويتها.",
      ],
    },
    {
      id: "cookies",
      heading: "6. ملفات تعريف الارتباط (Cookies)",
      paragraphs: [
        "نستخدمها لتحسين الأداء وتذكّر تفضيلاتك وتحليل استخدام الموقع، ويمكنك تعطيلها من إعدادات المتصفح متى شئت.",
      ],
    },
    {
      id: "rights",
      heading: "7. حقوقك",
      paragraphs: [
        "يحق لك طلب نسخة من بياناتك، وتحديثها، وطلب حذفها مع مراعاة الالتزامات القانونية والمالية والضريبية.",
      ],
    },
    {
      id: "updates",
      heading: "8. التحديثات",
      paragraphs: ["قد نحدّث هذه السياسة من حين لآخر، وتنشر النسخة المحدّثة على الموقع."],
    },
    {
      id: "contact",
      heading: "9. التواصل",
      paragraphs: ["لاستفسارات الخصوصية: {{email}} · {{phone}}."],
    },
  ],
};

export const privacyPolicy = { en, ar };
