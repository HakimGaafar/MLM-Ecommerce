import { z } from "zod";

/** Lowercase handle used on the merchant login page (not the customer email). */
export const MERCHANT_USERNAME_MIN = 3;
export const MERCHANT_USERNAME_MAX = 30;

export const MERCHANT_USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;

const RESERVED_MERCHANT_USERNAMES = new Set([
  "admin",
  "administrator",
  "affiliate",
  "api",
  "customer",
  "fources",
  "help",
  "login",
  "mail",
  "marketer",
  "merchant",
  "register",
  "root",
  "seller",
  "support",
  "system",
  "vendor",
  "www",
]);

export function normalizeMerchantUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidMerchantUsername(value: string): boolean {
  const normalized = normalizeMerchantUsername(value);
  if (!MERCHANT_USERNAME_PATTERN.test(normalized)) return false;
  return !RESERVED_MERCHANT_USERNAMES.has(normalized);
}

export const MerchantUsernameSchema = z
  .string()
  .transform(normalizeMerchantUsername)
  .pipe(
    z
      .string()
      .min(MERCHANT_USERNAME_MIN)
      .max(MERCHANT_USERNAME_MAX)
      .regex(
        MERCHANT_USERNAME_PATTERN,
        "Username must be 3–30 characters, start with a letter, and use only letters, numbers, or underscores",
      )
      .refine((value) => !RESERVED_MERCHANT_USERNAMES.has(value), "This username is not available"),
  );

export const MerchantLoginSchema = z.object({
  username: MerchantUsernameSchema,
  password: z.string().min(10).max(128),
});
