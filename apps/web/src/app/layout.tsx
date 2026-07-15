import type { Metadata } from "next";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import SiteShell from "@/components/SiteShell";
import ThemeScript from "@/components/ThemeScript";
import AppProviders from "@/components/providers/AppProviders";
import { getAppLocale } from "@/lib/ui-locale";
import { getThemePreference } from "@/lib/theme-preference";
import { getServerSession } from "@/lib/server-session";

export const metadata: Metadata = {
  title: "MLM Ecommerce Platform",
  description: "Shop from trusted marketplace vendors. Earn wallet cashback and grow with affiliate rewards.",
};

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
