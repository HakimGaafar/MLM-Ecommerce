import type { PolicyDocument } from "../types";

const en: PolicyDocument = {
  documentType: "PRICING_PAYMENT",
  locale: "en",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "Product prices are shown in the currency of the market you shop from. Tax, shipping and the total are shown clearly before you complete payment.",
      ],
    },
    {
      id: "currencies",
      heading: "1. Currencies by market",
      bullets: [
        "Display and invoice currency for this market: {{currency}}.",
        "Your bank or card issuer may apply a currency conversion fee when you pay in a currency different from your card’s currency.",
      ],
    },
    {
      id: "how-prices",
      heading: "2. How prices are shown",
      paragraphs: [
        "The product price is the price set by the Merchant and does not include tax or shipping. Value added tax is calculated for each Merchant separately: at its country’s rate if the Merchant is tax-registered, and at zero if not. These lines appear separately in your cart and order summary: product value, discount if any, tax, shipping, then the total. No hidden charges are added after payment.",
      ],
    },
    {
      id: "example",
      heading: "Illustrative example (this market, {{vatPercent}}% tax)",
      bullets: [
        "Product value: 100.000 {{currency}} | 100.000 {{currency}}",
        "Shipping: 2.000 {{currency}} | 2.000 {{currency}}",
        "Tax ({{vatPercent}}% on 102): 5.100 {{currency}} | 0.000 {{currency}} (non-registered Merchant)",
        "Total: 107.100 {{currency}} | 102.000 {{currency}}",
      ],
    },
    {
      id: "payment-methods",
      heading: "3. Payment methods",
      paragraphs: [
        "Online payments are processed through a licensed payment gateway (which may differ by market) by Visa and Mastercard cards and the local payment methods available in your country. Available methods differ by market and appear on the payment page. The platform does not store your card details.",
      ],
    },
    {
      id: "cod",
      heading: "4. Cash on delivery",
      paragraphs: [
        "Available for certain orders only: products delivered by the Merchant itself within the Merchant’s own city, shown at checkout. The platform may disable it at any time.",
      ],
    },
    {
      id: "invoices",
      heading: "5. Invoices",
      paragraphs: [
        "An order summary reaches you immediately after the order. The final invoice is issued after the return period ends (15 days from receipt). It is issued by the Merchant (tax or simplified, according to its registration); when you buy from another market or the International market, it is issued by the Representative Company. A separate shipping invoice is issued when shipping goes through the platform’s warehouse. To buy in a company’s name, select “Buying for a company” and enter its details.",
      ],
    },
    {
      id: "refunds",
      heading: "6. Refunds",
      paragraphs: [
        "Amounts are returned to the same payment method under the Returns, Cancellation & Exchange policy published on the site.",
      ],
    },
    {
      id: "inquiries",
      heading: "7. Payment inquiries",
      paragraphs: ["{{email}} · WhatsApp / phone {{phone}}."],
    },
  ],
};

const ar: PolicyDocument = {
  documentType: "PRICING_PAYMENT",
  locale: "ar",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "تظهر أسعار المنتجات بعملة السوق الذي تتسوّق منه، وتظهر الضريبة والشحن والإجمالي بشكل واضح قبل إتمام الدفع.",
      ],
    },
    {
      id: "currencies",
      heading: "1. العملات حسب السوق",
      bullets: [
        "عملة العرض والفاتورة لهذا السوق: {{currency}}.",
        "قد يطبق بنكك أو مصدر بطاقتك رسوم تحويل عملة عند الدفع بعملة تختلف عن عملة بطاقتك.",
      ],
    },
    {
      id: "how-prices",
      heading: "2. كيف تُعرض الأسعار",
      paragraphs: [
        "سعر المنتج هو السعر الذي حدده التاجر، ولا يشمل الضريبة والشحن. تُحسب ضريبة القيمة المضافة لكل تاجر على حدة: بنسبة بلده إن كان مسجّلاً ضريبياً، وبصفر إن لم يكن. تظهر هذه البنود مستقلة في سلة الشراء وفي ملخص الطلب: قيمة المنتج، الخصم إن وجد، الضريبة، الشحن، ثم الإجمالي. لا تضاف أي رسوم خفية بعد الدفع.",
      ],
    },
    {
      id: "example",
      heading: "مثال توضيحي (هذا السوق، ضريبة {{vatPercent}}%)",
      bullets: [
        "قيمة المنتج: 100.000 {{currency}} | 100.000 {{currency}}",
        "الشحن: 2.000 {{currency}} | 2.000 {{currency}}",
        "الضريبة ({{vatPercent}}% على 102): 5.100 {{currency}} | 0.000 {{currency}} (تاجر غير مسجّل)",
        "الإجمالي: 107.100 {{currency}} | 102.000 {{currency}}",
      ],
    },
    {
      id: "payment-methods",
      heading: "3. وسائل الدفع",
      paragraphs: [
        "تُعالج المدفوعات الإلكترونية عبر بوابة الدفع المرخصة (تختلف حسب السوق) ببطاقات فيزا وماستركارد، ووسائل الدفع المحلية المتاحة في بلدك. تختلف الوسائل المتاحة من سوق إلى آخر وتظهر في صفحة الدفع. لا تخزّن المنصة بيانات بطاقتك.",
      ],
    },
    {
      id: "cod",
      heading: "4. الدفع عند الاستلام",
      paragraphs: [
        "متاح لبعض الطلبات فقط: المنتجات التي يوصلها التاجر نفسه داخل مدينته، ويظهر ذلك عند الدفع. قد توقفه المنصة في أي وقت.",
      ],
    },
    {
      id: "invoices",
      heading: "5. الفواتير",
      paragraphs: [
        "يصلك ملخص الطلب فور إتمامه، وتصدر الفاتورة النهائية بعد انتهاء فترة الإرجاع (15 يوماً من الاستلام). تصدر من التاجر (ضريبية أو مبسطة حسب تسجيله)، وعند الشراء من سوق آخر أو السوق الدولي تصدر من الشركة الممثلة. وتُصدر فاتورة شحن مستقلة عند الشحن عبر مستودع المنصة. للشراء باسم شركة فعّل خيار «الشراء لشركة» وأدخل بياناتها.",
      ],
    },
    {
      id: "refunds",
      heading: "6. الاسترداد",
      paragraphs: [
        "تُعاد المبالغ إلى نفس وسيلة الدفع حسب سياسة الاسترجاع والإلغاء المنشورة على الموقع.",
      ],
    },
    {
      id: "inquiries",
      heading: "7. استفسارات الدفع",
      paragraphs: ["{{email}} · واتساب / هاتف {{phone}}."],
    },
  ],
};

export const pricingPaymentPolicy = { en, ar };
