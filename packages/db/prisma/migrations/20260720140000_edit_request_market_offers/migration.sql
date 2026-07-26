-- Store proposed multi-market offers on product edit requests so admin approval can apply them.
ALTER TABLE "product_edit_requests" ADD COLUMN "proposed_offers_json" JSONB;
