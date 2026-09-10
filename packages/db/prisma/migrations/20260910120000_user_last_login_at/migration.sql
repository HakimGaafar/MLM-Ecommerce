-- Track last successful login for "active customer" admin metrics.
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);

CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at");
