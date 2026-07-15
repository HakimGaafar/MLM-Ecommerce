import PDFDocument from "pdfkit";
import type { CommissionInvoiceRenderDto, VendorSaleInvoiceRenderDto } from "@mlm/domain";
import { getInvoicePdfLabels, type InvoicePdfLabels, type InvoicePdfLocale } from "./invoice-pdf-locale";
import { hasArabic, labelTextOptions } from "./pdf-arabic-text";
import { invoicePdfFonts, registerInvoiceFonts, textAlign, type InvoicePdfFonts } from "./pdf-fonts";
import { loadInvoiceLogo } from "./pdf-assets";

type PdfDoc = InstanceType<typeof PDFDocument>;

const MARGIN = 48;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function money(value: string, currency: string): string {
  return `${value} ${currency}`;
}

function logoFallbackFont(fonts: InvoicePdfFonts, label: string): string {
  return fonts.rtl && hasArabic(label) ? fonts.labelBold : fonts.dataBold;
}

async function drawLogoSlot(
  doc: PdfDoc,
  fonts: InvoicePdfFonts,
  logoUrl: string | null | undefined,
  fallbackLabel: string,
  x: number,
  y: number,
  align: "left" | "right",
): Promise<number> {
  const buffer = await loadInvoiceLogo(logoUrl);
  const slotWidth = 130;
  const maxHeight = 44;

  if (buffer) {
    try {
      const imageX = align === "right" ? x + slotWidth - 120 : x;
      doc.image(buffer, imageX, y, { fit: [120, maxHeight] });
      return y + maxHeight + 12;
    } catch {
      // fall through
    }
  }

  const textX = align === "right" ? x + slotWidth - 140 : x;
  doc
    .font(logoFallbackFont(fonts, fallbackLabel))
    .fontSize(11)
    .fillColor("#1a1a1a")
    .text(fallbackLabel, textX, y + 12, { width: 140, align, ...labelTextOptions(fonts) });
  return y + 36;
}

function drawDivider(doc: PdfDoc, y: number) {
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).strokeColor("#d4d4d4").lineWidth(1).stroke();
}

type PartyLine = string | { label: string; value: string };

function drawPartyBlock(
  doc: PdfDoc,
  fonts: InvoicePdfFonts,
  title: string,
  lines: PartyLine[],
  x: number,
  y: number,
  width: number,
): number {
  const align = textAlign(fonts);
  doc
    .font(fonts.labelBold)
    .fontSize(10)
    .fillColor("#525252")
    .text(title, x, y, { width, align, ...labelTextOptions(fonts) });
  let cursor = y + 14;
  for (const line of lines) {
    if (typeof line === "string") {
      if (!line.trim()) continue;
      doc.font(fonts.data).fontSize(10).fillColor("#171717");
      doc.text(line, x, cursor, { width, align: fonts.rtl ? "right" : "left" });
      cursor += doc.heightOfString(line, { width, align: fonts.rtl ? "right" : "left" }) + 2;
      continue;
    }
    drawLabelValue(doc, fonts, line.label, line.value, x, cursor, width, fonts.rtl ? "right" : "left");
    cursor += 14;
  }
  return cursor;
}

function drawLabelValue(
  doc: PdfDoc,
  fonts: InvoicePdfFonts,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  side: "left" | "right",
): void {
  const labelText = `${label}: `;
  doc.font(fonts.label).fontSize(10).fillColor("#525252");
  const labelW = doc.widthOfString(labelText, labelTextOptions(fonts));
  doc.font(fonts.data).fontSize(10).fillColor("#171717");
  const valueW = doc.widthOfString(value);
  const totalW = labelW + valueW;

  if (fonts.rtl || side === "right") {
    const startX = side === "right" ? x + width - totalW : x;
    doc.font(fonts.label).fillColor("#525252").text(labelText, startX, y, { lineBreak: false, ...labelTextOptions(fonts) });
    doc.font(fonts.data).fillColor("#171717").text(value, startX + labelW, y, { lineBreak: false });
    return;
  }

  doc.font(fonts.label).fillColor("#525252").text(labelText, x, y, { continued: true, width });
  doc.font(fonts.data).fillColor("#171717").text(value);
}

function drawMetaBlock(
  doc: PdfDoc,
  fonts: InvoicePdfFonts,
  rows: { label: string; value: string }[],
  y: number,
): number {
  let cursor = y;
  for (const row of rows) {
    drawLabelValue(doc, fonts, row.label, row.value, MARGIN, cursor, CONTENT_WIDTH, fonts.rtl ? "right" : "left");
    cursor += 16;
  }
  return cursor;
}

function drawMetaRow(
  doc: PdfDoc,
  fonts: InvoicePdfFonts,
  left: { label: string; value: string },
  right: { label: string; value: string },
  y: number,
): number {
  if (fonts.rtl) {
    return drawMetaBlock(doc, fonts, [right, left], y);
  }
  const half = CONTENT_WIDTH / 2;
  drawLabelValue(doc, fonts, left.label, left.value, MARGIN, y, half, "left");
  drawLabelValue(doc, fonts, right.label, right.value, MARGIN + half, y, half, "right");
  return y + 16;
}

function drawTitle(doc: PdfDoc, fonts: InvoicePdfFonts, title: string, y: number): number {
  doc.font(fonts.labelBold).fontSize(20).fillColor("#111111");
  const h = doc.heightOfString(title, { width: CONTENT_WIDTH, align: "center", ...labelTextOptions(fonts) });
  doc.text(title, MARGIN, y, { width: CONTENT_WIDTH, align: "center", ...labelTextOptions(fonts) });
  return y + h + 12;
}

function drawTableHeader(doc: PdfDoc, fonts: InvoicePdfFonts, labels: InvoicePdfLabels, y: number): number {
  const cols = fonts.rtl
    ? [
        { label: labels.lineTotal, x: MARGIN, w: 72 },
        { label: labels.unitPrice, x: MARGIN + 78, w: 72 },
        { label: labels.qty, x: MARGIN + 156, w: 32 },
        { label: labels.product, x: MARGIN + 194, w: 175 },
        { label: labels.unit, x: MARGIN + 375, w: 72 },
      ]
    : [
        { label: labels.unit, x: MARGIN, w: 72 },
        { label: labels.product, x: MARGIN + 78, w: 175 },
        { label: labels.qty, x: MARGIN + 258, w: 32 },
        { label: labels.unitPrice, x: MARGIN + 296, w: 72 },
        { label: labels.lineTotal, x: MARGIN + 374, w: 72 },
      ];

  doc.font(fonts.labelBold).fontSize(9).fillColor("#404040");
  const align = textAlign(fonts);
  for (const col of cols) {
    doc.text(col.label, col.x, y, { width: col.w, align, ...labelTextOptions(fonts) });
  }
  const lineY = y + 14;
  drawDivider(doc, lineY);
  return lineY + 8;
}

function drawLineRow(
  doc: PdfDoc,
  fonts: InvoicePdfFonts,
  line: { unitLabel: string | null; productName: string; quantity: number; unitPrice: string; lineTotal: string },
  y: number,
): number {
  const align = fonts.rtl ? "right" : "left";
  const cols = fonts.rtl
    ? [
        { text: line.lineTotal, x: MARGIN, w: 72 },
        { text: line.unitPrice, x: MARGIN + 78, w: 72 },
        { text: String(line.quantity), x: MARGIN + 156, w: 32 },
        { text: line.productName, x: MARGIN + 194, w: 175 },
        { text: line.unitLabel ?? "—", x: MARGIN + 375, w: 72 },
      ]
    : [
        { text: line.unitLabel ?? "—", x: MARGIN, w: 72 },
        { text: line.productName, x: MARGIN + 78, w: 175 },
        { text: String(line.quantity), x: MARGIN + 258, w: 32 },
        { text: line.unitPrice, x: MARGIN + 296, w: 72 },
        { text: line.lineTotal, x: MARGIN + 374, w: 72 },
      ];

  doc.font(fonts.data).fontSize(9).fillColor("#171717");
  let rowHeight = 0;
  for (const col of cols) {
    rowHeight = Math.max(rowHeight, doc.heightOfString(col.text, { width: col.w, align }));
  }
  for (const col of cols) {
    doc.text(col.text, col.x, y, { width: col.w, align });
  }
  return y + rowHeight + 10;
}

function drawTotals(
  doc: PdfDoc,
  fonts: InvoicePdfFonts,
  rows: { label: string; value: string; bold?: boolean }[],
  y: number,
): number {
  const labelWidth = 170;
  const valueWidth = 90;
  const valueX = fonts.rtl ? MARGIN : MARGIN + CONTENT_WIDTH - valueWidth;
  const labelX = fonts.rtl ? MARGIN + valueWidth + 8 : valueX - labelWidth - 8;
  const labelAlign = fonts.rtl ? "left" : "right";
  const valueAlign = fonts.rtl ? "left" : "right";
  let cursor = y;

  for (const row of rows) {
    const labelFont = row.bold ? fonts.labelBold : fonts.label;
    const valueFont = row.bold ? fonts.dataBold : fonts.data;
    const size = row.bold ? 11 : 10;

    doc.font(labelFont).fontSize(size).fillColor("#171717");
    const labelH = doc.heightOfString(row.label, { width: labelWidth, align: labelAlign, ...labelTextOptions(fonts) });
    doc.font(valueFont).fontSize(size);
    const valueH = doc.heightOfString(row.value, { width: valueWidth, align: valueAlign });
    const rowH = Math.max(labelH, valueH, size + 2);

    doc.font(labelFont).fontSize(size).fillColor("#171717");
    doc.text(row.label, labelX, cursor, { width: labelWidth, align: labelAlign, ...labelTextOptions(fonts) });
    doc.font(valueFont).text(row.value, valueX, cursor, { width: valueWidth, align: valueAlign });

    cursor += rowH + 8;
  }
  return cursor;
}

const FOOTER_LINE_HEIGHT = 11;
const FOOTER_LINE_GAP = 4;

function drawFooterBlock(doc: PdfDoc, fonts: InvoicePdfFonts, lines: string[], contentEndY: number): void {
  const lineCount = lines.length;
  const textBlockHeight = lineCount * FOOTER_LINE_HEIGHT + (lineCount - 1) * FOOTER_LINE_GAP;
  const footerTop = PAGE_HEIGHT - MARGIN - textBlockHeight;
  const dividerY = footerTop - 10;

  const range = doc.bufferedPageRange();
  doc.switchToPage(range.start + range.count - 1);

  if (contentEndY > dividerY - 4) {
    doc.addPage();
  }

  const top = PAGE_HEIGHT - MARGIN - textBlockHeight;
  drawDivider(doc, top - 10);
  doc.font(fonts.label).fontSize(8).fillColor("#737373");

  for (let i = 0; i < lines.length; i++) {
    const y = top + i * (FOOTER_LINE_HEIGHT + FOOTER_LINE_GAP);
    doc.text(lines[i], MARGIN, y, {
      width: CONTENT_WIDTH,
      align: "center",
      lineBreak: false,
    });
  }
}

export async function renderVendorSaleInvoicePdf(
  data: VendorSaleInvoiceRenderDto,
  locale: InvoicePdfLocale,
): Promise<Buffer> {
  const labels = getInvoicePdfLabels(locale);
  const fonts = invoicePdfFonts(locale);

  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
        if (fonts.locale === "ar") registerInvoiceFonts(doc);

        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const leftLogoX = fonts.rtl ? MARGIN + CONTENT_WIDTH - 130 : MARGIN;
        const rightLogoX = fonts.rtl ? MARGIN : MARGIN + CONTENT_WIDTH - 130;

        const headerBottom = Math.max(
          await drawLogoSlot(doc, fonts, data.platformLogoUrl, labels.forseiz, leftLogoX, MARGIN, fonts.rtl ? "right" : "left"),
          await drawLogoSlot(doc, fonts, data.seller.logoUrl, data.seller.legalName, rightLogoX, MARGIN, fonts.rtl ? "left" : "right"),
        );

        let metaY = drawTitle(doc, fonts, labels.taxInvoice, headerBottom);
        metaY = drawMetaRow(
          doc,
          fonts,
          { label: labels.invoiceNo, value: data.invoiceNo },
          { label: labels.date, value: data.issuedAt.slice(0, 10) },
          metaY,
        );
        metaY = drawMetaBlock(doc, fonts, [{ label: labels.order, value: data.orderNo }], metaY);

        const partiesY = metaY + 12;
        drawDivider(doc, partiesY - 6);

        const sellerLines: PartyLine[] = [
          data.seller.legalName,
          ...(data.seller.vatTrn ? [{ label: labels.vatTrn, value: data.seller.vatTrn }] : []),
          data.seller.addressLine1,
          data.seller.addressLine2 ?? "",
          `${data.seller.city}, ${data.seller.postalCode}, ${data.seller.countryCode}`,
        ].filter((line) => (typeof line === "string" ? line.trim() : true));
        const buyerLines = [
          data.buyer.name,
          data.buyer.email,
          data.buyer.addressLine1 ?? "",
          data.buyer.addressLine2 ?? "",
          [data.buyer.city, data.buyer.postalCode, data.buyer.countryCode].filter(Boolean).join(", "),
          data.buyer.phone ?? "",
        ];

        const colWidth = CONTENT_WIDTH / 2 - 12;
        const sellerX = fonts.rtl ? MARGIN + CONTENT_WIDTH / 2 + 12 : MARGIN;
        const buyerX = fonts.rtl ? MARGIN : MARGIN + CONTENT_WIDTH / 2 + 12;

        const sellerBottom = drawPartyBlock(doc, fonts, labels.seller, sellerLines, sellerX, partiesY, colWidth);
        const buyerBottom = drawPartyBlock(doc, fonts, labels.billTo, buyerLines, buyerX, partiesY, colWidth);

        let tableY = Math.max(sellerBottom, buyerBottom) + 16;
        tableY = drawTableHeader(doc, fonts, labels, tableY);
        for (const line of data.lines) {
          tableY = drawLineRow(doc, fonts, line, tableY);
        }

        drawDivider(doc, tableY + 4);
        const totalsEnd = drawTotals(
          doc,
          fonts,
          [
            { label: labels.subtotal, value: money(data.subtotal, data.currency) },
            ...(Number(data.discountShare) > 0 ? [{ label: labels.discount, value: `-${money(data.discountShare, data.currency)}` }] : []),
            ...(Number(data.shippingShare) > 0 ? [{ label: labels.shipping, value: money(data.shippingShare, data.currency) }] : []),
            { label: labels.vat, value: money(data.vatTotal, data.currency) },
            { label: labels.total, value: money(data.totalAmount, data.currency), bold: true },
          ],
          tableY + 14,
        );

        drawFooterBlock(doc, fonts, [labels.footerTax(data.seller.legalName), labels.footerMarketplace], totalsEnd);
        doc.end();
      } catch (e) {
        reject(e);
      }
    })();
  });
}

export async function renderCommissionInvoicePdf(
  data: CommissionInvoiceRenderDto,
  locale: InvoicePdfLocale,
): Promise<Buffer> {
  const labels = getInvoicePdfLabels(locale);
  const fonts = invoicePdfFonts(locale);

  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
        if (fonts.locale === "ar") registerInvoiceFonts(doc);

        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const leftLogoX = fonts.rtl ? MARGIN + CONTENT_WIDTH - 130 : MARGIN;
        const rightLogoX = fonts.rtl ? MARGIN : MARGIN + CONTENT_WIDTH - 130;

        const headerBottom = Math.max(
          await drawLogoSlot(doc, fonts, data.seller.logoUrl, labels.forseiz, leftLogoX, MARGIN, fonts.rtl ? "right" : "left"),
          await drawLogoSlot(doc, fonts, data.buyer.logoUrl, data.buyer.legalName, rightLogoX, MARGIN, fonts.rtl ? "left" : "right"),
        );

        let metaY = drawTitle(doc, fonts, labels.commissionInvoice, headerBottom);
        metaY = drawMetaRow(
          doc,
          fonts,
          { label: labels.invoiceNo, value: data.invoiceNo },
          { label: labels.date, value: data.issuedAt.slice(0, 10) },
          metaY,
        );
        metaY = drawMetaBlock(doc, fonts, [{ label: labels.relatedOrder, value: data.relatedOrderNo }], metaY);

        const partiesY = metaY + 12;
        drawDivider(doc, partiesY - 6);

        const fromLines: PartyLine[] = [
          data.seller.legalName,
          ...(data.seller.vatTrn ? [{ label: labels.vatTrn, value: data.seller.vatTrn }] : []),
          data.seller.addressLine1,
          data.seller.addressLine2 ?? "",
          `${data.seller.city}, ${data.seller.postalCode}, ${data.seller.countryCode}`,
        ].filter((line) => (typeof line === "string" ? line.trim() : true));
        const toLines: PartyLine[] = [
          data.buyer.legalName,
          ...(data.buyer.vatTrn ? [{ label: labels.vatTrn, value: data.buyer.vatTrn }] : []),
          data.buyer.addressLine1,
          `${data.buyer.city}, ${data.buyer.postalCode}, ${data.buyer.countryCode}`,
        ].filter((line) => (typeof line === "string" ? line.trim() : true));

        const colWidth = CONTENT_WIDTH / 2 - 12;
        const fromX = fonts.rtl ? MARGIN + CONTENT_WIDTH / 2 + 12 : MARGIN;
        const toX = fonts.rtl ? MARGIN : MARGIN + CONTENT_WIDTH / 2 + 12;

        const fromBottom = drawPartyBlock(doc, fonts, labels.fromPlatform, fromLines, fromX, partiesY, colWidth);
        const toBottom = drawPartyBlock(doc, fonts, labels.toVendor, toLines, toX, partiesY, colWidth);

        const totalsY = Math.max(fromBottom, toBottom) + 24;
        drawDivider(doc, totalsY - 8);
        const totalsEnd = drawTotals(
          doc,
          fonts,
          [
            { label: labels.platformCommission, value: money(data.commissionSubtotal, data.currency) },
            { label: labels.vat, value: money(data.vatTotal, data.currency) },
            { label: labels.totalDue, value: money(data.totalAmount, data.currency), bold: true },
          ],
          totalsY,
        );

        drawFooterBlock(doc, fonts, [labels.footerCommission(data.seller.legalName)], totalsEnd);
        doc.end();
      } catch (e) {
        reject(e);
      }
    })();
  });
}
