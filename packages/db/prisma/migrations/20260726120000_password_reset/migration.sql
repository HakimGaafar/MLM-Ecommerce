-- Password reset tokens (hashed) and admin audit trail.
CREATE TYPE "PasswordResetAuditAction" AS ENUM (
  'RESET_REQUESTED',
  'RESET_COMPLETED',
  'CHANGE_NOTIFICATION_SENT',
  'CHANGE_NOTIFICATION_FAILED'
);

CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_used_at_idx" ON "password_reset_tokens"("user_id", "used_at");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "password_reset_audit_logs" (
    "id" TEXT NOT NULL,
    "action" "PasswordResetAuditAction" NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "user_id" TEXT,
    "ip_address" VARCHAR(64),
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_reset_audit_logs_created_at_idx" ON "password_reset_audit_logs"("created_at");
CREATE INDEX "password_reset_audit_logs_email_created_at_idx" ON "password_reset_audit_logs"("email", "created_at");
CREATE INDEX "password_reset_audit_logs_action_created_at_idx" ON "password_reset_audit_logs"("action", "created_at");

ALTER TABLE "password_reset_audit_logs"
  ADD CONSTRAINT "password_reset_audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
