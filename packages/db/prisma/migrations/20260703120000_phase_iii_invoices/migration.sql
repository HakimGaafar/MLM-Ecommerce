-- Phase III: dual invoicing — vendor invoice profile + stored PDF records
CREATE TYPE "InvoiceDocumentType" AS ENUM ('VENDOR_SALE', 'COMMISSION');

ALTER TABLE "vendors" ADD COLUMN "invoice_legal_name" VARCHAR(200);
ALTER TABLE "vendors" ADD COLUMN "invoice_vat_trn" VARCHAR(32);
ALTER TABLE "vendors" ADD COLUMN "invoice_address_line_1" VARCHAR(200);
ALTER TABLE "vendors" ADD COLUMN "invoice_address_line_2" VARCHAR(200);
ALTER TABLE "vendors" ADD COLUMN "invoice_city" VARCHAR(120);
ALTER TABLE "vendors" ADD COLUMN "invoice_postal_code" VARCHAR(20);
ALTER TABLE "vendors" ADD COLUMN "invoice_country_code" CHAR(2);
ALTER TABLE "vendors" ADD COLUMN "invoice_logo_url" VARCHAR(500);

CREATE TABLE "order_invoices" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "document_type" "InvoiceDocumentType" NOT NULL,
    "invoice_no" VARCHAR(64) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "file_url" VARCHAR(500),
    "subtotal" DECIMAL(18,2) NOT NULL,
    "vat_total" DECIMAL(18,2) NOT NULL,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'SAR',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_download_logs" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_download_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_invoices_invoice_no_key" ON "order_invoices"("invoice_no");
CREATE UNIQUE INDEX "order_invoices_order_id_vendor_id_document_type_key" ON "order_invoices"("order_id", "vendor_id", "document_type");
CREATE INDEX "order_invoices_order_id_idx" ON "order_invoices"("order_id");
CREATE INDEX "order_invoices_vendor_id_idx" ON "order_invoices"("vendor_id");
CREATE INDEX "invoice_download_logs_invoice_id_idx" ON "invoice_download_logs"("invoice_id");
CREATE INDEX "invoice_download_logs_user_id_downloaded_at_idx" ON "invoice_download_logs"("user_id", "downloaded_at");

ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_download_logs" ADD CONSTRAINT "invoice_download_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "order_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_download_logs" ADD CONSTRAINT "invoice_download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
