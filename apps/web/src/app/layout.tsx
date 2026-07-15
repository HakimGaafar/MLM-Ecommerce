import type { Metadata } from "next";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import SiteShell from "@/components/SiteShell";
import ThemeScript from "@/components/ThemeScript";
import AppProviders from "@/components/providers/AppProviders";
import { getAppLocale } from "@/lib/ui-locale";
import { getThemePreference } from "@/lib/theme-preference";
import { getServerSession } from "@/lib/server-session";
import { getBrandName } from "@/lib/brand";

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
  const direction = locale === "ar" ? "rtl" : "ltr";

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
          <SiteShell>{children}</SiteShell>
          <SiteFooter compact={Boolean(session)} />
        </AppProviders>
      </body>
    </html>
  );
}
