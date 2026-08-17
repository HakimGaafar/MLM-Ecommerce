-- Required reference roles (registration, vendor onboarding, affiliate activation).
-- Idempotent: safe on fresh DBs and databases that were migrated before seed was run.

INSERT INTO "roles" ("id", "code", "updated_at")
VALUES
  ('role_admin', 'ADMIN', CURRENT_TIMESTAMP),
  ('role_super_admin', 'SUPER_ADMIN', CURRENT_TIMESTAMP),
  ('role_vendor', 'VENDOR', CURRENT_TIMESTAMP),
  ('role_customer', 'CUSTOMER', CURRENT_TIMESTAMP),
  ('role_affiliate', 'AFFILIATE', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
