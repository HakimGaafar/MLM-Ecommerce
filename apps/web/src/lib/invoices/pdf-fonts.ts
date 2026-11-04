import path from "node:path";
import type PDFDocument from "pdfkit";
import type { InvoicePdfLocale } from "./invoice-pdf-locale";

export const ARABIC_REGULAR = "InvoiceArabicRegular";
export const ARABIC_BOLD = "InvoiceArabicBold";

const fontPaths = {
  regular: path.join(process.cwd(), "assets/fonts/NotoSansArabic-Regular.ttf"),
  bold: path.join(process.cwd(), "assets/fonts/NotoSansArabic-Bold.ttf"),
};

/** Arabic labels + Helvetica for numbers, Latin names, amounts. */
export type InvoicePdfFonts = {
  locale: InvoicePdfLocale;
  rtl: boolean;
  label: string;
  labelBold: string;
  data: string;
  dataBold: string;
};

export function registerInvoiceFonts(doc: InstanceType<typeof PDFDocument>): void {
  doc.registerFont(ARABIC_REGULAR, fontPaths.regular);
  doc.registerFont(ARABIC_BOLD, fontPaths.bold);
}

export function invoicePdfFonts(locale: InvoicePdfLocale): InvoicePdfFonts {
  if (locale === "ar") {
    return {
      locale,
      rtl: true,
      label: ARABIC_REGULAR,
      labelBold: ARABIC_BOLD,
      // Use Arabic-capable fonts for data too — Helvetica mojibakes Arabic names/addresses (N-038).
      data: ARABIC_REGULAR,
      dataBold: ARABIC_BOLD,
    };
  }
  return {
    locale,
    rtl: false,
    label: "Helvetica",
    labelBold: "Helvetica-Bold",
    data: "Helvetica",
    dataBold: "Helvetica-Bold",
  };
}

/** Pick a font that can render the string (Arabic content even on EN invoices). */
export function fontForText(fonts: InvoicePdfFonts, text: string, bold = false): string {
  if (/[\u0600-\u06FF]/.test(text)) {
    return bold ? ARABIC_BOLD : ARABIC_REGULAR;
  }
  return bold ? fonts.dataBold : fonts.data;
}

export function textAlign(fonts: InvoicePdfFonts): "left" | "right" | "center" {
  return fonts.rtl ? "right" : "left";
}
