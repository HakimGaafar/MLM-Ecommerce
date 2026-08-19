-- Merchant portal login: optional unique username (3–30 chars, lowercase).

ALTER TABLE "users" ADD COLUMN "username" VARCHAR(30);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
