-- CreateTable
CREATE TABLE "vendor_permissions" (
    "vendor_id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "granted_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_permissions_pkey" PRIMARY KEY ("vendor_id","code")
);

-- CreateIndex
CREATE INDEX "vendor_permissions_vendor_id_idx" ON "vendor_permissions"("vendor_id");

-- AddForeignKey
ALTER TABLE "vendor_permissions" ADD CONSTRAINT "vendor_permissions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
