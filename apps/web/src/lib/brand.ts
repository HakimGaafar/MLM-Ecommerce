import type { MarketCode } from "@mlm/shared";

export type BrandLocale = "en" | "ar";

export const BRAND_NAME_EN = "Fources";
export const BRAND_NAME_AR = "فورسيز";
export const BRAND_LOGO_PATH = "/brand/fources-logo.png";

export const BRAND_LINKS = {
  facebook: "https://www.facebook.com/profile.php?id=61584624971371",
  instagram: "https://www.instagram.com/4ces_store",
  youtube: "https://www.youtube.com/channel/UCwyHpMeBFb5DbOCW014rv8g",
  x: "https://x.com/fources179721",
  maps: "https://maps.app.goo.gl/qYSFDbMNaF9YXAT9A?g_st=ic",
  whatsapp: "https://wa.me/96877523743",
} as const;

/** Human-readable; always render with `dir="ltr"` in RTL layouts. */
export const BRAND_WHATSAPP_DISPLAY = "+968 7752 3743";

type MarketContact = {
  maps: string;
  whatsapp: string;
  whatsappDisplay: string;
};

const DEFAULT_CONTACT: MarketContact = {
  maps: BRAND_LINKS.maps,
  whatsapp: BRAND_LINKS.whatsapp,
  whatsappDisplay: BRAND_WHATSAPP_DISPLAY,
};

const SA_MAPS_DEFAULT = "https://www.google.com/maps/search/?api=1&query=Riyadh%2C+Saudi+Arabia";
const EG_MAPS_DEFAULT = "https://www.google.com/maps/search/?api=1&query=Cairo%2C+Egypt";

function envOrDefault(envValue: string | undefined, fallback: string): string {
  const trimmed = envValue?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function whatsappFromEnv(envValue: string | undefined, displayValue: string | undefined) {
  const digits = envValue?.replace(/\D/g, "") ?? "";
  if (digits.length < 8) return { whatsapp: "", whatsappDisplay: "" };
  return {
    whatsapp: `https://wa.me/${digits}`,
    whatsappDisplay: envOrDefault(displayValue, `+${digits}`),
  };
}

function marketWhatsapp(
  envValue: string | undefined,
  displayValue: string | undefined,
  fallback?: Pick<MarketContact, "whatsapp" | "whatsappDisplay">,
) {
  const fromEnv = whatsappFromEnv(envValue, displayValue);
  if (fromEnv.whatsapp) return fromEnv;
  return fallback ?? { whatsapp: "", whatsappDisplay: "" };
}

/** Per-market support details. SA/EG WhatsApp only appear when env numbers are set. */
export const MARKET_CONTACT: Record<MarketCode, MarketContact> = {
  OM: {
    maps: envOrDefault(process.env.NEXT_PUBLIC_MAPS_OM, DEFAULT_CONTACT.maps),
    ...marketWhatsapp(
      process.env.NEXT_PUBLIC_WHATSAPP_OM,
      process.env.NEXT_PUBLIC_WHATSAPP_OM_DISPLAY,
      DEFAULT_CONTACT,
    ),
  },
  SA: {
    maps: envOrDefault(process.env.NEXT_PUBLIC_MAPS_SA, SA_MAPS_DEFAULT),
    ...marketWhatsapp(process.env.NEXT_PUBLIC_WHATSAPP_SA, process.env.NEXT_PUBLIC_WHATSAPP_SA_DISPLAY),
  },
  EG: {
    maps: envOrDefault(process.env.NEXT_PUBLIC_MAPS_EG, EG_MAPS_DEFAULT),
    ...marketWhatsapp(process.env.NEXT_PUBLIC_WHATSAPP_EG, process.env.NEXT_PUBLIC_WHATSAPP_EG_DISPLAY),
  },
  GLOBAL: {
    maps: envOrDefault(process.env.NEXT_PUBLIC_MAPS_GLOBAL, DEFAULT_CONTACT.maps),
    ...marketWhatsapp(
      process.env.NEXT_PUBLIC_WHATSAPP_GLOBAL,
      process.env.NEXT_PUBLIC_WHATSAPP_GLOBAL_DISPLAY,
      DEFAULT_CONTACT,
    ),
  },
};

export function getMarketContact(code: MarketCode): MarketContact {
  return MARKET_CONTACT[code] ?? DEFAULT_CONTACT;
}

export function getBrandName(locale: BrandLocale): string {
  return locale === "ar" ? BRAND_NAME_AR : BRAND_NAME_EN;
}
