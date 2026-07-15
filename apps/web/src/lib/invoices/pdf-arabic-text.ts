import type PDFDocument from "pdfkit";

type PdfDoc = InstanceType<typeof PDFDocument>;

export type InvoiceTextOptions = NonNullable<Parameters<PdfDoc["text"]>[1]>;

const ARABIC_RE = /[\u0600-\u06FF]/;

export function hasArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

/** OpenType Arabic shaping — fixes word order and letter joining in PDFKit. */
export function arabicTextOptions(options: InvoiceTextOptions = {}): InvoiceTextOptions {
  return { ...options, features: ["rtla"] };
}

export function labelTextOptions(fonts: { rtl: boolean }, options: InvoiceTextOptions = {}): InvoiceTextOptions {
  return fonts.rtl ? arabicTextOptions(options) : options;
}
