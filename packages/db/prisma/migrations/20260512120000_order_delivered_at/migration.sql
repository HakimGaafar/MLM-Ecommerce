-- Customer return window uses delivered_at (set when order reaches COMPLETED).
ALTER TABLE "orders" ADD COLUMN "delivered_at" TIMESTAMP(3);

UPDATE "orders"
SET "delivered_at" = "updated_at"
WHERE "status" = 'COMPLETED';
