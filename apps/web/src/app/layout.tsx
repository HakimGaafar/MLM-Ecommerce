import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import SiteShell from "@/components/SiteShell";
import ThemeScript from "@/components/ThemeScript";
import GlobalCustomsNotice from "@/components/international/GlobalCustomsNotice";
import AppProviders from "@/components/providers/AppProviders";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getAppLocale } from "@/lib/ui-locale";
import { getThemePreference } from "@/lib/theme-preference";
import { getInternationalShoppingNoticeStatus } from "@mlm/domain";
import { getServerSession } from "@/lib/server-session";
import { getBrandName } from "@/lib/brand";
import { getActiveMarket } from "@/lib/market-server";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getAppLocale();
  const brandName = getBrandName(locale);
  return {
    title: {
      default: brandName,
      template: `%s | ${brandName}`,
    },
    description:
      locale === "ar"
        ? "تسوّق من بائعين موثوقين واكسب مكافآت واستردادًا نقديًا."
        : "Shop from trusted marketplace vendors. Earn wallet cashback and affiliate rewards.",
    icons: {
      icon: [{ url: "/brand/fources-icon.png?v=3", type: "image/png" }],
      shortcut: "/brand/fources-icon.png?v=3",
      apple: "/brand/fources-apple-icon.png?v=3",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getAppLocale();
  const theme = await getThemePreference();
  const session = await getServerSession();
  const market = await getActiveMarket();
  const cookieStore = await cookies();
  const activeRole = resolveActiveRole(
    session?.roles ?? [],
    cookieStore.get(ACTIVE_ROLE_COOKIE)?.value,
  );
  const direction = locale === "ar" ? "rtl" : "ltr";
  const internationalUi =
    locale === "ar" ? ar.internationalNotices.customer : en.internationalNotices.customer;
  const eligibleForNotice =
    market.code === "GLOBAL" &&
    (activeRole === "CUSTOMER" || activeRole === "AFFILIATE") &&
    Boolean(session?.sub);
  const shoppingNotice = eligibleForNotice
    ? await getInternationalShoppingNoticeStatus(session!.sub)
    : null;
  const showGlobalCustomsNotice = eligibleForNotice && !shoppingNotice?.accepted;

  return (
    <html
      lang={locale}
      dir={direction}
      data-scroll-behavior="smooth"
      className={`h-full antialiased ${theme === "dark" ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]" cz-shortcut-listen="true">
        <ThemeScript theme={theme} />
        <AppProviders
          locale={locale}
          guestLanguageMode={!session?.roles?.includes("CUSTOMER")}
        >
          <GlobalCustomsNotice enabled={showGlobalCustomsNotice} ui={internationalUi} />
          <SiteShell>{children}</SiteShell>
          <SiteFooter compact={Boolean(session)} />
        </AppProviders>
      </body>
    </html>
  );
}
