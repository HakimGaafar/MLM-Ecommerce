-- Revocable sessions: bump token_version to invalidate outstanding JWTs.
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
