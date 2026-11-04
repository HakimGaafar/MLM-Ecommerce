export const RESERVED_STORE_SLUGS = new Set([
  "admin",
  "api",
  "login",
  "register",
  "sell",
  "seller",
  "stores",
  "store",
  "vendor",
  "customer",
  "products",
  "product",
  "cart",
  "checkout",
  "dashboard",
  "profile",
  "orders",
  "returns",
  "cashback",
  "static",
  "assets",
  "www",
]);

/** Minimal Arabic → Latin so Arabic store names still produce a full slug (not empty / one letter). */
const ARABIC_TO_LATIN: Record<string, string> = {
  "\u0627": "a", // ا
  "\u0623": "a", // أ
  "\u0625": "i", // إ
  "\u0622": "a", // آ
  "\u0621": "", // ء
  "\u0624": "w", // ؤ
  "\u0626": "y", // ئ
  "\u0628": "b", // ب
  "\u062A": "t", // ت
  "\u062B": "th", // ث
  "\u062C": "j", // ج
  "\u062D": "h", // ح
  "\u062E": "kh", // خ
  "\u062F": "d", // د
  "\u0630": "dh", // ذ
  "\u0631": "r", // ر
  "\u0632": "z", // ز
  "\u0633": "s", // س
  "\u0634": "sh", // ش
  "\u0635": "s", // ص
  "\u0636": "d", // ض
  "\u0637": "t", // ط
  "\u0638": "z", // ظ
  "\u0639": "a", // ع
  "\u063A": "gh", // غ
  "\u0641": "f", // ف
  "\u0642": "q", // ق
  "\u0643": "k", // ك
  "\u0644": "l", // ل
  "\u0645": "m", // م
  "\u0646": "n", // ن
  "\u0647": "h", // ه
  "\u0629": "a", // ة
  "\u0648": "w", // و
  "\u064A": "y", // ي
  "\u0649": "y", // ى
  "\u0660": "0",
  "\u0661": "1",
  "\u0662": "2",
  "\u0663": "3",
  "\u0664": "4",
  "\u0665": "5",
  "\u0666": "6",
  "\u0667": "7",
  "\u0668": "8",
  "\u0669": "9",
};

function approximateNonLatin(name: string): string {
  let out = "";
  for (const ch of name.normalize("NFKC")) {
    const mapped = ARABIC_TO_LATIN[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch.toLowerCase();
      continue;
    }
    if (/\s|_|\-/.test(ch)) {
      out += "-";
    }
  }
  return out;
}

/**
 * Build a URL-safe store slug from the full store name (not the first character only).
 * Latin letters/digits are kept; Arabic is approximated to Latin so the slug stays usable.
 */
export function slugifyStoreName(name: string): string {
  const prepared = approximateNonLatin(name.trim());
  return prepared
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48);
}

export function isReservedStoreSlug(slug: string): boolean {
  return RESERVED_STORE_SLUGS.has(slug);
}
