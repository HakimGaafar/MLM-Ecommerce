-- Phase XII4: Stripe webhook event deduplication

CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "id" VARCHAR(255) NOT NULL,
  "type" VARCHAR(128) NOT NULL,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stripe_webhook_events_processed_at_idx"
  ON "stripe_webhook_events" ("processed_at");
