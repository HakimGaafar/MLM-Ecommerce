-- Phase VIII: platform configuration + SUPER_ADMIN role

CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "cashback_rate" DECIMAL(8,6) NOT NULL,
    "affiliate_pool_rate" DECIMAL(8,6) NOT NULL,
    "affiliate_level1_rate" DECIMAL(8,6) NOT NULL,
    "affiliate_level2_rate" DECIMAL(8,6) NOT NULL,
    "affiliate_level3_rate" DECIMAL(8,6) NOT NULL,
    "affiliate_level4_rate" DECIMAL(8,6) NOT NULL,
    "vendor_rate" DECIMAL(8,6) NOT NULL,
    "platform_rate" DECIMAL(8,6) NOT NULL,
    "min_withdrawal_amount_sar" DECIMAL(18,2) NOT NULL,
    "return_window_days" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" TEXT,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_config" (
    "id",
    "cashback_rate",
    "affiliate_pool_rate",
    "affiliate_level1_rate",
    "affiliate_level2_rate",
    "affiliate_level3_rate",
    "affiliate_level4_rate",
    "vendor_rate",
    "platform_rate",
    "min_withdrawal_amount_sar",
    "return_window_days",
    "updated_at"
) VALUES (
    'default',
    0.05,
    0.10,
    0.05,
    0.02,
    0.02,
    0.01,
    0.70,
    0.30,
    250.00,
    15,
    CURRENT_TIMESTAMP
);
