import type { PolicyDocument } from "../types";

const en: PolicyDocument = {
  documentType: "RETURNS",
  locale: "en",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "You may request a return or exchange within 15 days of receiving your order, under the conditions below. This page covers cancellation, returns, exchange and their financial effect.",
      ],
    },
    {
      id: "cancel-before-ship",
      heading: "1. Cancellation before shipping",
      bullets: [
        "The full order value is refunded to the same payment method, with no deductions, unless a non-cancellable service has already been performed.",
        "No cashback or referral commission is due on a cancelled order.",
      ],
    },
    {
      id: "cancel-after-ship",
      heading: "2. Cancellation after shipping",
      paragraphs: [
        "An order cannot be cancelled after it ships. A cancellation request is treated as a return request and all return conditions apply, including shipping fees where applicable.",
      ],
    },
    {
      id: "general-returns",
      heading: "3. General conditions for returns after shipping or delivery",
      bullets: [
        "The return request is made within 15 days of receipt.",
        "The product is unused, in its original condition, with all accessories and packaging. Products showing signs of use or damage are not accepted.",
        "The order number or proof of purchase is required.",
        "The refund is made only after the returned product is received and inspected by the Merchant or the platform.",
        "If approved, only the product value is refunded; shipping fees (if any) and any collection fees charged by a third party during payment are deducted, unless the error is the Merchant’s or the platform’s.",
        "If the return is rejected, no amount is refunded and the order is considered complete and final.",
      ],
    },
    {
      id: "defect",
      heading: "4. Return for a defect or non-conformity with the description",
      bullets: [
        "Notify us within 48 hours of receipt, with photos or video showing the problem.",
        "The product is replaced or refunded in full at no extra charge, and the Merchant bears the return shipping in this case.",
        "If no replacement is available, the amount is refunded by the same payment method.",
      ],
    },
    {
      id: "customer-request",
      heading: "5. Return at the Customer’s request",
      paragraphs: [
        "The Customer bears shipping and return costs, the product is inspected before the request is accepted, and the refund is made within 14 working days after approval.",
      ],
    },
    {
      id: "exchange",
      heading: "6. Exchange",
      bullets: [
        "An exchange can be requested before shipping, subject to availability of the replacement.",
        "After shipping or receipt, the request is treated as a return plus a new order; all return conditions apply, and any price difference and shipping are calculated on the new order.",
        "Cashback and referral commissions are calculated on the new completed order only.",
      ],
    },
    {
      id: "non-returnable",
      heading: "7. Non-returnable products (stated on the product page before purchase)",
      bullets: [
        "Digital products once downloaded (e-books, courses, licences).",
        "Perfumes, personal-care products and opened health or consumable items.",
        "In-ear headphones and personal-use items.",
        "Devices that were opened or powered on, unless there is a manufacturing defect.",
        "Made-to-order or customised products.",
        "Gift cards and paid subscriptions.",
        "Fast-perishable goods.",
      ],
    },
    {
      id: "submit",
      heading: "8. How to submit a request",
      paragraphs: [
        "Contact {{email}} or WhatsApp / phone {{phone}} with the order number, product name, reason for return or exchange, and photos or video if there is a defect. For orders crossing markets, the return method and cost are shown when the request is submitted.",
      ],
    },
    {
      id: "refunded-amounts",
      heading: "9. Refunded amounts",
      paragraphs: [
        "Refunds go back by the same payment method; cash-on-delivery orders are refunded by bank transfer. When a return request is made, the Customer is notified of the amount that will be refunded and of any amounts that will be deducted (shipping both ways and the financial charges applied by the payment gateway, if any), and the refund is carried out only after the Customer agrees; the Customer may decline the deduction and withdraw the return request. The platform or the Merchant bears these charges, or they share them, depending on the reason for the return: nothing is deducted from the Customer where the reason is a defective product or an error by the Merchant or the platform. If an order is refused on delivery after shipping, the same procedure applies: the Customer is notified of the shipping value both ways and the gateway’s financial charges before they are deducted from the refund.",
      ],
    },
    {
      id: "notes",
      heading: "10. Notes",
      paragraphs: [
        "Electronic devices are subject to the manufacturer’s warranty. The platform may update this policy by publishing a new version, with no effect on orders already confirmed.",
      ],
    },
    {
      id: "consent",
      heading: "Explicit consent",
      bullets: [
        "☐ I agree to the cancellation, return and exchange policy and its financial effect (at registration).",
        "☐ I confirm I have reviewed this policy and agree to the financial terms that apply to my request (when submitting a cancellation, return or exchange request).",
      ],
    },
  ],
};

const ar: PolicyDocument = {
  documentType: "RETURNS",
  locale: "ar",
  sections: [
    {
      id: "intro",
      paragraphs: [
        "يمكنك طلب الاسترجاع أو الاستبدال خلال 15 يوماً من تاريخ استلام الطلب، وفق الشروط أدناه. تشمل هذه الصفحة الإلغاء والاسترجاع والاستبدال وأثرها المالي.",
      ],
    },
    {
      id: "cancel-before-ship",
      heading: "أولاً: الإلغاء قبل الشحن",
      bullets: [
        "يُرد كامل قيمة الطلب إلى وسيلة الدفع نفسها، دون أي استقطاع، ما لم تكن خدمة غير قابلة للإلغاء قد نُفّذت.",
        "لا يستحق العميل كاش باك أو عمولات إحالة عن طلب ملغى.",
      ],
    },
    {
      id: "cancel-after-ship",
      heading: "ثانياً: الإلغاء بعد الشحن",
      paragraphs: [
        "لا يمكن إلغاء الطلب بعد شحنه، ويُعامل طلب الإلغاء كطلب استرجاع تسري عليه كامل شروطه، بما فيها رسوم الشحن إن وُجدت.",
      ],
    },
    {
      id: "general-returns",
      heading: "ثالثاً: الشروط العامة للاسترجاع بعد الشحن أو التسليم",
      bullets: [
        "طلب الاسترجاع خلال 15 يوماً من الاستلام.",
        "المنتج غير مستخدم، وبحالته الأصلية، مع جميع ملحقاته وتغليفه. لا تُقبل المنتجات التي تظهر عليها علامات استخدام أو تلف.",
        "رقم الطلب أو إثبات الشراء ضروري.",
        "تُرد القيمة بعد استلام المنتج المرتجع وفحص حالته من التاجر أو المنصة.",
        "عند الموافقة تُرد قيمة المنتج فقط، وتُخصم رسوم الشحن (إن وُجدت) وأي رسوم تحصيل خُصمت عبر طرف ثالث أثناء الدفع، ما لم يكن الخطأ من التاجر أو المنصة.",
        "عند الرفض: لا تُرد مبالغ، ويُعتبر الطلب مكتملاً ونهائياً.",
      ],
    },
    {
      id: "defect",
      heading: "رابعاً: الاسترجاع بسبب عيب أو عدم مطابقة للوصف",
      bullets: [
        "أبلغنا خلال 48 ساعة من الاستلام، مع صور أو فيديو توضّح المشكلة.",
        "يتم الاستبدال أو الاسترجاع كاملاً دون رسوم إضافية، ويتحمل التاجر شحن الإرجاع في هذه الحالة.",
        "إذا لم يتوفر بديل، يُعاد المبلغ بنفس طريقة الدفع.",
      ],
    },
    {
      id: "customer-request",
      heading: "خامساً: الاسترجاع بناءً على رغبة العميل",
      paragraphs: [
        "يتحمل العميل تكلفة الشحن والإرجاع، ويُفحص المنتج قبل قبول الطلب، وتتم إعادة المبلغ خلال 14 يوم عمل بعد الموافقة.",
      ],
    },
    {
      id: "exchange",
      heading: "سادساً: الاستبدال",
      bullets: [
        "يمكن طلب الاستبدال قبل الشحن، ويخضع لتوفر المنتج البديل.",
        "بعد الشحن أو الاستلام يُعامل الطلب كاسترجاع مع طلب جديد، وتسري عليه شروط الاسترجاع كاملة، وتُحسب فروق الأسعار ورسوم الشحن على الطلب الجديد.",
        "يُحتسب الكاش باك وعمولات الإحالة على الطلب الجديد المكتمل فقط.",
      ],
    },
    {
      id: "non-returnable",
      heading: "سابعاً: منتجات غير قابلة للاسترجاع أو الاستبدال (ويُوضح ذلك في صفحة المنتج قبل الشراء)",
      bullets: [
        "المنتجات الرقمية بعد تنزيلها (كتب إلكترونية، دورات، تراخيص).",
        "العطور ومنتجات العناية الشخصية والمستلزمات الصحية المفتوحة.",
        "سماعات الأذن الداخلية ومنتجات الاستخدام الشخصي.",
        "الأجهزة التي فُتحت أو شُغّلت، إلا لعيب مصنعي.",
        "المنتجات المصنّعة حسب الطلب أو بتخصيص خاص.",
        "بطاقات الهدايا والاشتراكات المدفوعة.",
        "السلع الاستهلاكية سريعة التلف.",
      ],
    },
    {
      id: "submit",
      heading: "ثامناً: كيف تقدّم الطلب",
      paragraphs: [
        "تواصل معنا على {{email}} أو واتساب / هاتف {{phone}}، وزوّدنا برقم الطلب واسم المنتج وسبب الاسترجاع أو الاستبدال، مع صور أو فيديو عند وجود خلل. في الطلبات العابرة للأسواق تُبيّن طريقة الإرجاع وتكلفته عند تقديم الطلب.",
      ],
    },
    {
      id: "refunded-amounts",
      heading: "تاسعاً: المبالغ المسترجعة",
      paragraphs: [
        "تُعاد المبالغ عبر نفس وسيلة الدفع، والدفع عند الاستلام يُعاد عبر تحويل بنكي. عند تقديم طلب الاسترجاع يُخطر العميل بالمبلغ الذي سيُرد إليه وبأي مبالغ ستُستقطع منه (رسوم الشحن ذهاباً وإياباً، والرسوم المالية التي طبقتها بوابة الدفع إن وُجدت)، ولا يُنفذ الاسترجاع إلا بعد موافقته، وله رفض الخصم والتراجع عن طلب الاسترجاع. وتتحمل المنصة أو التاجر هذه الرسوم أو يتقاسمانها بحسب سبب الاسترجاع: فلا يُخصم من العميل شيء إذا كان السبب عيباً في المنتج أو خطأً من التاجر أو المنصة. وفي حال رفض استلام الطلب بعد شحنه تُطبَّق الآلية نفسها: يُخطر العميل بقيمة الشحن ذهاباً وإياباً وبالرسوم المالية المطبقة من بوابة الدفع قبل خصمها من المبلغ المسترد.",
      ],
    },
    {
      id: "notes",
      heading: "عاشراً: ملاحظات",
      paragraphs: [
        "تخضع الأجهزة الإلكترونية لسياسة ضمان المصنّع. ويحق للمنصة تعديل هذه السياسة بنشر نسخة محدّثة، دون أثر على طلبات تم تأكيدها.",
      ],
    },
    {
      id: "consent",
      heading: "الموافقة الصريحة",
      bullets: [
        "☐ أوافق على سياسة الإلغاء والاسترجاع والاستبدال والأثر المالي المترتب عليها (عند التسجيل).",
        "☐ أقرّ بمراجعتي هذه السياسة وأوافق على الشروط المالية المطبقة على طلبي (عند تقديم طلب إلغاء أو استرجاع أو استبدال).",
      ],
    },
  ],
};

export const returnsPolicy = { en, ar };
