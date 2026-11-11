-- Phase 7: admin confirms DNS/host is already pointed at the app before publish.

ALTER TABLE "markets"
  ADD COLUMN IF NOT EXISTS "host_routing_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "host_routing_confirmed_at" TIMESTAMP(3);
