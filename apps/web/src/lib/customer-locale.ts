import { prisma } from "@mlm/db";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { verifyAccessToken } from "@/lib/auth";
import { GUEST_LOCALE_COOKIE } from "@/lib/ui-locale";

export type SupportedLocale = "en" | "ar";

function localeFromGuestCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): SupportedLocale {
  const raw = cookieStore.get(GUEST_LOCALE_COOKIE)?.value;
  return raw === "ar" ? "ar" : "en";
}

export async function getCustomerPreferredLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const guestLocale = localeFromGuestCookie(cookieStore);

  const token = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!token) return guestLocale;

  const session = await verifyAccessToken(token).catch(() => null);
  if (!session?.sub) return guestLocale;

  // Language switch always sets mlm_guest_locale; prefer it so router.refresh() matches UI immediately.
  const explicitGuest = cookieStore.get(GUEST_LOCALE_COOKIE)?.value;
  if (explicitGuest === "ar" || explicitGuest === "en") {
    return explicitGuest;
  }

  const profile = await prisma.customerProfile.findUnique({
    where: { userId: session.sub },
    select: { preferredLanguage: true },
  });

  if (!profile) return guestLocale;

  return profile.preferredLanguage === "ar" ? "ar" : "en";
}
