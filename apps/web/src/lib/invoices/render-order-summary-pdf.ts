import type { CustomerOrderDetailDto } from "@mlm/domain";
import PDFDocument from "pdfkit";
import type { InvoicePdfLocale } from "./invoice-pdf-locale";
import type { OrderSummaryPdfLabels } from "./order-summary-pdf-labels";
import { labelTextOptions } from "./pdf-arabic-text";
import { invoicePdfFonts, registerInvoiceFonts, textAlign } from "./pdf-fonts";
import {
  paymentMethodDisplayText,
  paymentStatusDisplayText,
} from "@/lib/order-payment-display";

const MARGIN = 48;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type PdfDoc = InstanceType<typeof PDFDocument>;

function money(value: string, currency: string): string {
  return `${value} ${currency}`;
}

function drawDivider(doc: PdfDoc, y: number) {
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).strokeColor("#d4d4d4").lineWidth(1).stroke();
}

function drawLabelValue(
  doc: PdfDoc,
  fonts: ReturnType<typeof invoicePdfFonts>,
  label: string,
  value: string,
  y: number,
): number {
  doc.font(fonts.label).fontSize(10).fillColor("#525252");
  doc.text(`${label}: `, MARGIN, y, { continued: true, ...labelTextOptions(fonts) });
  doc.font(fonts.data).fontSize(10).fillColor("#171717").text(value);
  return y + 16;
}

export async function renderOrderSummaryPdf(
  order: CustomerOrderDetailDto,
  labels: OrderSummaryPdfLabels,
  locale: InvoicePdfLocale,
): Promise<Buffer> {
  const fonts = invoicePdfFonts(locale);
  const paymentUi = {
    paymentCod: labels.paymentCod,
    paymentOnlineCard: labels.paymentOnlineCard,
    paymentWalletCovered: labels.paymentWalletCovered,
    paymentPending: labels.paymentPending,
    paymentPaid: labels.paymentPaid,
    paymentFailed: labels.paymentFailed,
    paymentRefunded: labels.paymentRefunded,
  };

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
      if (fonts.locale === "ar") registerInvoiceFonts(doc);

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Forseiz";
      let y = MARGIN;

      doc.font(fonts.labelBold).fontSize(16).fillColor("#111111");
      doc.text(appName, MARGIN, y, { width: CONTENT_WIDTH, ...labelTextOptions(fonts) });
      y += 22;

      doc.font(fonts.labelBold).fontSize(13).fillColor("#171717");
      doc.text(labels.title, MARGIN, y, { width: CONTENT_WIDTH, ...labelTextOptions(fonts) });
      y += 20;

      y = drawLabelValue(doc, fonts, labels.orderNo, order.orderNo, y);
      y = drawLabelValue(doc, fonts, labels.issued, order.createdAt.slice(0, 10), y);

      if (order.shipping) {
        y += 4;
        drawDivider(doc, y);
        y += 12;
        doc.font(fonts.labelBold).fontSize(10).fillColor("#525252");
        doc.text(labels.billTo, MARGIN, y, { width: CONTENT_WIDTH, ...labelTextOptions(fonts) });
        y += 14;
        const addressLines = [
          order.shipping.recipientName,
          order.shipping.addressLine1,
          order.shipping.addressLine2 ?? "",
          `${order.shipping.city}, ${order.shipping.postalCode}, ${order.shipping.countryCode}`,
          order.shipping.phone,
        ].filter(Boolean);
        doc.font(fonts.data).fontSize(10).fillColor("#171717");
        for (const line of addressLines) {
          doc.text(line, MARGIN, y, { width: CONTENT_WIDTH, align: textAlign(fonts) });
          y += doc.heightOfString(line, { width: CONTENT_WIDTH }) + 2;
        }
      }

      y += 8;
      drawDivider(doc, y);
      y += 14;

      doc.font(fonts.labelBold).fontSize(9).fillColor("#404040");
      const align = textAlign(fonts);
      const cols = fonts.rtl
        ? [
            { label: labels.lineTotal, x: MARGIN, w: 72 },
            { label: labels.unit, x: MARGIN + 78, w: 72 },
            { label: labels.qty, x: MARGIN + 156, w: 32 },
            { label: labels.product, x: MARGIN + 194, w: CONTENT_WIDTH - 194 },
          ]
        : [
            { label: labels.product, x: MARGIN, w: CONTENT_WIDTH - 194 },
            { label: labels.qty, x: MARGIN + CONTENT_WIDTH - 194, w: 32 },
            { label: labels.unit, x: MARGIN + CONTENT_WIDTH - 156, w: 72 },
            { label: labels.lineTotal, x: MARGIN + CONTENT_WIDTH - 78, w: 72 },
          ];
      for (const col of cols) {
        doc.text(col.label, col.x, y, { width: col.w, align, ...labelTextOptions(fonts) });
      }
      y += 14;
      drawDivider(doc, y);
      y += 8;

      for (const line of order.lineItems) {
        const productText = `${line.productName}\n${labels.vendor}: ${line.vendorName}`;
        const rowCols = fonts.rtl
          ? [
              { text: money(line.lineTotal, order.currency), x: MARGIN, w: 72 },
              { text: money(line.unitPrice, order.currency), x: MARGIN + 78, w: 72 },
              { text: String(line.quantity), x: MARGIN + 156, w: 32 },
              { text: productText, x: MARGIN + 194, w: CONTENT_WIDTH - 194 },
            ]
          : [
              { text: productText, x: MARGIN, w: CONTENT_WIDTH - 194 },
              { text: String(line.quantity), x: MARGIN + CONTENT_WIDTH - 194, w: 32 },
              { text: money(line.unitPrice, order.currency), x: MARGIN + CONTENT_WIDTH - 156, w: 72 },
              { text: money(line.lineTotal, order.currency), x: MARGIN + CONTENT_WIDTH - 78, w: 72 },
            ];

        doc.font(fonts.data).fontSize(9).fillColor("#171717");
        let rowHeight = 0;
        for (const col of rowCols) {
          rowHeight = Math.max(rowHeight, doc.heightOfString(col.text, { width: col.w, align }));
        }
        for (const col of rowCols) {
          doc.text(col.text, col.x, y, { width: col.w, align });
        }
        y += rowHeight + 10;
      }

      y += 4;
      drawDivider(doc, y);
      y += 14;

      const totalsX = fonts.rtl ? MARGIN : MARGIN + CONTENT_WIDTH - 220;
      const totals = [
        { label: labels.subtotal, value: money(order.subtotal, order.currency) },
        { label: labels.shipping, value: money(order.shippingFee, order.currency) },
        { label: labels.discount, value: `-${money(order.discountTotal, order.currency)}` },
        { label: labels.vat, value: money(order.vatTotal, order.currency) },
        { label: labels.total, value: money(order.totalAmount, order.currency), bold: true },
      ];

      for (const row of totals) {
        const labelFont = row.bold ? fonts.labelBold : fonts.label;
        const valueFont = row.bold ? fonts.dataBold : fonts.data;
        doc.font(labelFont).fontSize(row.bold ? 11 : 10).fillColor("#171717");
        doc.text(row.label, totalsX, y, { width: 120, align: fonts.rtl ? "left" : "right", ...labelTextOptions(fonts) });
        doc.font(valueFont).text(row.value, totalsX + 128, y, { width: 92, align: fonts.rtl ? "left" : "right" });
        y += 18;
      }

      if (order.walletAppliedAmount !== "0" && order.walletAppliedAmount !== "0.00") {
        doc.font(fonts.label).fontSize(10).fillColor("#171717");
        doc.text(labels.walletApplied, totalsX, y, { width: 120, align: fonts.rtl ? "left" : "right", ...labelTextOptions(fonts) });
        doc.font(fonts.data).text(`-${money(order.walletAppliedAmount, order.currency)}`, totalsX + 128, y, {
          width: 92,
          align: fonts.rtl ? "left" : "right",
        });
        y += 18;
        doc.font(fonts.labelBold).fontSize(11);
        doc.text(labels.remainingDue, totalsX, y, { width: 120, align: fonts.rtl ? "left" : "right", ...labelTextOptions(fonts) });
        doc.font(fonts.dataBold).text(money(order.remainingAmount, order.currency), totalsX + 128, y, {
          width: 92,
          align: fonts.rtl ? "left" : "right",
        });
        y += 18;
      }

      y += 8;
      const paymentMethod = paymentMethodDisplayText(paymentUi, order.paymentMethodDisplay);
      const paymentStatus = paymentStatusDisplayText(paymentUi, order.paymentStatus);
      y = drawLabelValue(doc, fonts, labels.paymentMethod, paymentMethod, y);
      y = drawLabelValue(doc, fonts, labels.paymentStatus, paymentStatus, y);

      y += 12;
      doc.font(fonts.label).fontSize(9).fillColor("#737373");
      doc.text(labels.thankYou, MARGIN, y, { width: CONTENT_WIDTH, align: "center", ...labelTextOptions(fonts) });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
