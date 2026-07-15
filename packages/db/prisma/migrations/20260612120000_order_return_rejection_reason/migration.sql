-- Phase I: admin rejection reason when return is PROCESSING_REJECTED
ALTER TABLE "order_returns" ADD COLUMN "rejection_reason" TEXT;
