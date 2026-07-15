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
      data: "Helvetica",
      dataBold: "Helvetica-Bold",
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

export function textAlign(fonts: InvoicePdfFonts): "left" | "right" | "center" {
  return fonts.rtl ? "right" : "left";
}
