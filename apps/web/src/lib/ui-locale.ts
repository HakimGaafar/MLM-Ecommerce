import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { parseAppLocale, type AppLocale } from "@/lib/locale-shared";
import { getServerSession } from "@/lib/server-session";

export const GUEST_LOCALE_COOKIE = "mlm_guest_locale";

export type { AppLocale } from "@/lib/locale-shared";
export { parseAppLocale, catalogCategoriesUrl } from "@/lib/locale-shared";

export async function getAppLocale(): Promise<AppLocale> {
  const session = await getServerSession();
  if (session) {
    return getCustomerPreferredLocale();
  }
  const raw = (await cookies()).get(GUEST_LOCALE_COOKIE)?.value;
  return raw === "ar" ? "ar" : "en";
}

/** Prefer `?locale=` from client fetches; fall back to cookies/profile. */
export async function resolveRequestLocale(request: NextRequest): Promise<AppLocale> {
  const fromQuery = parseAppLocale(request.nextUrl.searchParams.get("locale"));
  if (fromQuery) return fromQuery;
  return getAppLocale();
}
