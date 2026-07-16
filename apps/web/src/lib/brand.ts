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

export function getBrandName(locale: BrandLocale): string {
  return locale === "ar" ? BRAND_NAME_AR : BRAND_NAME_EN;
}
