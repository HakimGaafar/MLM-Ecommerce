import type { PublicLegalLocale } from "./types";

/** Flat annex view used to inject placeholders into bundled policy text. */
export type MarketAnnexView = {
  legalNameEn: string;
  legalNameAr: string;
  commercialRegistration: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  consumerAuthorityEn: string;
  consumerAuthorityAr: string;
  currency: string;
  vatPercent: string;
  vatTrn: string;
  unifiedNumber: string;
};

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

function resolvePlaceholderKey(
  key: string,
  annex: MarketAnnexView,
  locale: PublicLegalLocale,
): string {
  switch (key) {
    case "legalName":
      return locale === "ar" ? annex.legalNameAr : annex.legalNameEn;
    case "legalNameEn":
      return annex.legalNameEn;
    case "legalNameAr":
      return annex.legalNameAr;
    case "commercialRegistration":
      return annex.commercialRegistration;
    case "address":
      return annex.address;
    case "city":
      return annex.city;
    case "phone":
      return annex.phone;
    case "email":
      return annex.email;
    case "consumerAuthority":
      return locale === "ar" ? annex.consumerAuthorityAr : annex.consumerAuthorityEn;
    case "consumerAuthorityEn":
      return annex.consumerAuthorityEn;
    case "consumerAuthorityAr":
      return annex.consumerAuthorityAr;
    case "currency":
      return annex.currency;
    case "vatPercent":
      return annex.vatPercent;
    case "vatTrn":
      return annex.vatTrn;
    case "unifiedNumber":
      return annex.unifiedNumber;
    default:
      return "";
  }
}

/** Replace `{{placeholders}}` in policy copy with market annex values. */
export function applyAnnexPlaceholders(
  text: string,
  annex: MarketAnnexView,
  locale: PublicLegalLocale,
): string {
  return text.replace(PLACEHOLDER_PATTERN, (_match, rawKey: string) => {
    return resolvePlaceholderKey(rawKey, annex, locale);
  });
}

function formatVatPercent(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value).replace(/\.?0+$/, "");
}

/** Build injector view from domain `getMarketAnnexForPublic` payload. */
export function toMarketAnnexView(annex: {
  issuer: {
    legalNameEn: string;
    legalNameAr: string;
    commercialRegistration: string | null;
    unifiedNumber: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    phone: string | null;
    email: string | null;
    consumerProtectionAuthorityEn: string | null;
    consumerProtectionAuthorityAr: string | null;
    vatTrn: string | null;
    vatPercent: number;
    currency: string;
  } | null;
  defaultCurrency: string;
}): MarketAnnexView {
  const issuer = annex.issuer;
  const address = issuer
    ? [issuer.addressLine1, issuer.addressLine2].filter(Boolean).join(", ")
    : "";

  return {
    legalNameEn: issuer?.legalNameEn ?? "",
    legalNameAr: issuer?.legalNameAr ?? "",
    commercialRegistration: issuer?.commercialRegistration ?? "",
    address,
    city: issuer?.city ?? "",
    phone: issuer?.phone ?? "",
    email: issuer?.email ?? "",
    consumerAuthorityEn: issuer?.consumerProtectionAuthorityEn ?? "",
    consumerAuthorityAr: issuer?.consumerProtectionAuthorityAr ?? "",
    currency: issuer?.currency ?? annex.defaultCurrency,
    vatPercent: issuer ? formatVatPercent(issuer.vatPercent) : "0",
    vatTrn: issuer?.vatTrn ?? "",
    unifiedNumber: issuer?.unifiedNumber ?? "",
  };
}
