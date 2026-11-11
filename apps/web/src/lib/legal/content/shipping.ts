import type { PolicyDocument } from "../types";

const en: PolicyDocument = {
  documentType: "SHIPPING",
  locale: "en",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "This policy aims to give our customers a reliable and transparent shopping experience across the VANDSOQ markets: Oman, Saudi Arabia, Egypt and the International market.",
      ],
    },
    {
      id: "methods",
      heading: "1. Shipping methods",
      bullets: [
        "Direct shipping by the Merchant: the Merchant ships its products to the Customer, and the shipping fee appears within the Merchant’s invoice.",
        "Shipping through the platform’s warehouse: the platform receives the product from the Merchant and ships it to the Customer, and issues a separate shipping invoice.",
        "Shipping between markets: the Merchant sets the shipping fee per product, or unified transport packages between approved markets apply.",
      ],
    },
    {
      id: "coverage",
      heading: "2. Delivery coverage",
      paragraphs: [
        "We deliver to all governorates of Oman, and to cities in Saudi Arabia, Egypt, and the Gulf and Middle East region for selected products. Availability is shown when you place the order.",
      ],
    },
    {
      id: "delivery-time",
      heading: "3. Estimated delivery time",
      paragraphs: [
        "Times vary by product type, region and courier, and may be longer for large items or items shipped from other suppliers. The Merchant prepares an order within 2 business days for ready products and 5 business days where special preparation is needed.",
      ],
    },
    {
      id: "fees",
      heading: "4. Shipping fees",
      paragraphs: [
        "Fees vary by product weight, destination, product category (regular, oversized, chilled, electronics) and shipping method. They appear clearly as a separate line before payment and are subject to value added tax where applicable. International shipping fees do not include customs clearance unless stated.",
      ],
    },
    {
      id: "multi-merchant",
      heading: "5. Orders from several merchants",
      paragraphs: [
        "An order may ship in several parcels if products come from different Merchants. Shipping fees are calculated per shipment and shown on the payment page before you complete the order; no fee is added after payment.",
      ],
    },
    {
      id: "receiving",
      heading: "6. Receiving your order",
      paragraphs: [
        "Please make sure the address and phone number are correct. If the courier cannot reach you, delivery may be rescheduled or the order cancelled.",
      ],
    },
    {
      id: "failed",
      heading: "7. Failed delivery",
      paragraphs: [
        "If the order is not received after delivery attempts, reshipping fees may apply, or the order may be cancelled with deduction of shipping and administrative charges.",
      ],
    },
    {
      id: "tracking",
      heading: "8. Tracking",
      paragraphs: [
        "Once shipped, you receive an SMS or email with a tracking number, or live updates in your account on the platform.",
      ],
    },
    {
      id: "international",
      heading: "9. International shipping",
      paragraphs: [
        "Some products cannot be shipped outside their market or between certain countries because of size limits or customs rules. This is shown before payment.",
      ],
    },
    {
      id: "delays",
      heading: "10. Shipping delays",
      paragraphs: [
        "Delays may occur because of weather, courier demand, seasons or public holidays. You will be notified promptly.",
      ],
    },
    {
      id: "support",
      heading: "11. Support",
      paragraphs: ["For inquiries or order status: {{email}} · WhatsApp / phone {{phone}}."],
    },
  ],
};

const ar: PolicyDocument = {
  documentType: "SHIPPING",
  locale: "ar",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "تهدف هذه السياسة إلى تقديم تجربة تسوّق موثوقة وواضحة لعملائنا في أسواق فاندسوق: عُمان والسعودية ومصر والسوق الدولي.",
      ],
    },
    {
      id: "methods",
      heading: "1. طرق الشحن",
      bullets: [
        "شحن مباشر من التاجر: يشحن التاجر منتجاته إلى العميل، وتظهر رسوم الشحن ضمن فاتورة التاجر.",
        "الشحن عبر مستودع المنصة: تستلم المنصة المنتج من التاجر وتشحنه للعميل، وتُصدر فاتورة شحن مستقلة.",
        "الشحن بين الأسواق: يحدد التاجر رسوم الشحن لكل منتج، أو تُطبق باقات نقل موحدة بين الأسواق المعتمدة.",
      ],
    },
    {
      id: "coverage",
      heading: "2. نطاق التوصيل",
      paragraphs: [
        "نشحن إلى جميع محافظات سلطنة عُمان، وإلى مدن المملكة ومصر ودول الخليج والشرق الأوسط لبعض المنتجات، ويظهر مدى توفر الشحن عند إتمام الطلب.",
      ],
    },
    {
      id: "delivery-time",
      heading: "3. مدة التوصيل التقريبية",
      paragraphs: [
        "تتغير المدة حسب نوع المنتج والمنطقة وشركة الشحن، وقد تزيد للمنتجات الكبيرة أو المشحونة من موردين آخرين. يجهّز التاجر الطلب خلال يومي عمل للمنتجات الجاهزة، وخمسة أيام لما يتطلب تجهيزاً خاصاً.",
      ],
    },
    {
      id: "fees",
      heading: "4. رسوم الشحن",
      paragraphs: [
        "تختلف حسب وزن المنتج، ومكان التوصيل، وفئة المنتج (عادي، كبير، مبرد، إلكترونيات)، وطريقة الشحن. تظهر الرسوم بوضوح كبند مستقل قبل إتمام الدفع، وتخضع لضريبة القيمة المضافة إن وجدت. لا تشمل الرسوم تخليص الجمارك في الشحن الدولي ما لم يُذكر ذلك صراحة.",
      ],
    },
    {
      id: "multi-merchant",
      heading: "5. الطلب من عدة تجار",
      paragraphs: [
        "قد يُشحن الطلب الواحد على دفعات متعددة إذا كانت المنتجات من تجار مختلفين. تُحسب رسوم الشحن لكل شحنة كما تظهر في صفحة الدفع قبل إتمام الطلب، ولا تضاف أي رسوم بعد الدفع.",
      ],
    },
    {
      id: "receiving",
      heading: "6. استلام الطلب",
      paragraphs: [
        "يجب التأكد من صحة العنوان ورقم الهاتف. في حال تعذر التواصل مع العميل، قد يُؤجل التوصيل أو يُلغى الطلب.",
      ],
    },
    {
      id: "failed",
      heading: "7. فشل التوصيل",
      paragraphs: [
        "إذا لم يُستلم الطلب بعد محاولات التوصيل، قد تُفرض رسوم إعادة شحن، أو يُلغى الطلب مع خصم رسوم الشحن والخدمات الإدارية.",
      ],
    },
    {
      id: "tracking",
      heading: "8. تتبع الشحنة",
      paragraphs: [
        "عند شحن الطلب ستصلك رسالة نصية أو بريد إلكتروني بكود التتبع، أو تحديث مباشر داخل حسابك في المنصة.",
      ],
    },
    {
      id: "international",
      heading: "9. الشحن الدولي",
      paragraphs: [
        "بعض المنتجات لا يمكن شحنها خارج سوقها أو بين بعض الدول بسبب قيود الحجم أو أنظمة الجمارك، ويُوضح ذلك للعميل قبل الدفع.",
      ],
    },
    {
      id: "delays",
      heading: "10. تأخير الشحن",
      paragraphs: [
        "قد يحدث تأخير بسبب الظروف الجوية أو ضغط شركات التوصيل أو المواسم والعطلات الرسمية، ويُبلغ العميل فوراً.",
      ],
    },
    {
      id: "support",
      heading: "11. الدعم",
      paragraphs: ["للاستفسار أو متابعة حالة الطلب: {{email}} · واتساب / هاتف {{phone}}."],
    },
  ],
};

export const shippingPolicy = { en, ar };
