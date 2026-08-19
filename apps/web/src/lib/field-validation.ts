export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
export const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
export const REGISTER_NAME_PATTERN = /^[\p{L}\p{N} .'-]{2,80}$/u;
export const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9]{4,24}$/;
export const MERCHANT_USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;

export function isValidMerchantUsername(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.length >= 3 && normalized.length <= 30 && MERCHANT_USERNAME_PATTERN.test(normalized);
}

export function isValidEmail(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
}

export function isStrongPassword(value: string) {
  if (value.length < 10 || value.length > 128) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return /[^A-Za-z0-9]/.test(value);
}

export function inputClassName(hasError: boolean, extra = "") {
  return ["app-input", hasError ? "app-input-invalid" : "", extra].filter(Boolean).join(" ");
}
