import type { PolicyDocument } from "../types";

const en: PolicyDocument = {
  documentType: "MERCHANT_DATA_CONFIRMATION",
  locale: "en",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "By accepting this confirmation you declare that the registration data, identity documents, and store information you submitted are true and that you have authority to bind the Merchant to the VANDSOQ merchant pack.",
      ],
    },
    {
      id: "accuracy",
      heading: "1. Accuracy",
      paragraphs: [
        "You will correct any error promptly. False or incomplete data may result in rejection, suspension, or termination, and may be reported where required by law.",
      ],
    },
    {
      id: "authority",
      heading: "2. Authority to bind",
      paragraphs: [
        "If you register on behalf of a company or establishment, you confirm you are an authorised representative. Acceptance of the cooperation, operational, and commission documents binds that entity.",
      ],
    },
    {
      id: "records",
      heading: "3. Records",
      paragraphs: [
        "Your acceptances are stored in the consent ledger with document type, policy version, timestamp, and IP address for audit.",
      ],
    },
  ],
};

const ar: PolicyDocument = {
  documentType: "MERCHANT_DATA_CONFIRMATION",
  locale: "ar",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "بقبولك هذا الإقرار تصرّح بأن بيانات التسجيل ووثائق الهوية ومعلومات المتجر صحيحة وأنك مخوّل بإلزام التاجر بحزمة تاجر VANDSOQ.",
      ],
    },
    {
      id: "accuracy",
      heading: "1. الدقة",
      paragraphs: [
        "ستصحّح أي خطأ فوراً. قد تؤدي البيانات الكاذبة أو الناقصة إلى الرفض أو الإيقاف أو الإنهاء، وقد تُبلَّغ للجهات عند الاقتضاء.",
      ],
    },
    {
      id: "authority",
      heading: "2. صلاحية الإلزام",
      paragraphs: [
        "إذا سجّلت باسم شركة أو مؤسسة فأنت تؤكد أنك ممثل مخوّل. قبول وثائق التعاون والتشغيل والعمولة يُلزم ذلك الكيان.",
      ],
    },
    {
      id: "records",
      heading: "3. السجلات",
      paragraphs: [
        "تُحفظ موافقاتك في سجل الموافقات مع نوع الوثيقة ونسخة السياسة والطابع الزمني وعنوان IP للتدقيق.",
      ],
    },
  ],
};

export const merchantDataConfirmationPolicy = { en, ar };
