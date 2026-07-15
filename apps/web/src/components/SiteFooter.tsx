import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getAppLocale } from "@/lib/ui-locale";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "MLM Ecommerce";

export default async function SiteFooter({ compact = false }: { compact?: boolean }) {
  const locale = await getAppLocale();
  const f = locale === "ar" ? ar.siteFooter : en.siteFooter;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const year = new Date().getFullYear();

  const socialUrl = (envKey: string, fallback: string) => {
    const fromEnv = process.env[envKey]?.trim();
    const href = (fromEnv && fromEnv.startsWith("http") ? fromEnv : fallback).trim();
    return href.startsWith("http") ? href : "";
  };

  const social = [
    { href: socialUrl("NEXT_PUBLIC_SOCIAL_FACEBOOK", f.socialFacebook), label: "Fb", title: "Facebook" },
    { href: socialUrl("NEXT_PUBLIC_SOCIAL_INSTAGRAM", f.socialInstagram), label: "Ig", title: "Instagram" },
    { href: socialUrl("NEXT_PUBLIC_SOCIAL_X", f.socialX), label: "X", title: "X" },
    { href: socialUrl("NEXT_PUBLIC_SOCIAL_LINKEDIN", f.socialLinkedIn), label: "Li", title: "LinkedIn" },
  ].filter((s) => s.href.length > 0);

  const essential = [
    { href: "/", label: f.home },
    { href: "/products", label: f.shop },
    { href: "/stores", label: f.storeList },
    { href: "/sell", label: f.becomeSeller, accent: true },
  ];


  return (
    <footer
      className="site-footer mt-auto border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_88%,var(--background))] backdrop-blur-sm"
      dir={direction}
    >
      <div className={compact ? "mx-auto max-w-6xl px-4 py-3 sm:px-6" : "mx-auto max-w-6xl px-4 py-5 sm:px-6"}>
        <div
          className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${compact ? "sm:gap-4" : "sm:gap-6"}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-semibold text-[var(--foreground)]">{appName}</span>
              {!compact ? (
                <span className="text-xs font-normal text-[var(--muted)] sm:text-sm">{f.tagline}</span>
              ) : null}
            </div>
            {f.contactEmail ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                <a href={`mailto:${f.contactEmail}`} className="text-link transition hover:underline">
                  {f.contactEmail}
                </a>
              </p>
            ) : null}
          </div>

          <nav
            className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm"
            aria-label={f.essentialTitle}
          >
            {essential.map((item, i) => (
              <span key={item.href} className="inline-flex items-center">
                {i > 0 ? (
                  <span className="mx-1.5 hidden text-[var(--muted)] opacity-50 sm:inline" aria-hidden>
                    ·
                  </span>
                ) : null}
                <Link
                  href={item.href}
                  className={
                    item.accent
                      ? "font-medium text-[var(--primary)] hover:underline"
                      : "text-[color-mix(in_srgb,var(--foreground)_75%,var(--muted))] transition hover:text-[var(--primary)]"
                  }
                >
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>

          <div className="flex flex-shrink-0 items-center gap-2">
            {social.length > 0 ? (
              <div className="flex items-center gap-1.5" aria-label={f.followUs}>
                {social.map((s) => (
                  <a
                    key={s.title}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.title}
                    className="flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--muted)] shadow-sm transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  >
                    <span className="sr-only">{s.title}</span>
                    <span aria-hidden className="leading-none">
                      {s.label}
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

      </div>

      <div className="border-t border-[var(--border)] px-4 py-2 text-center text-[0.65rem] text-[var(--muted)] sm:px-6">
        {f.copyright.replace("{year}", String(year)).replace("{name}", appName)}
      </div>
    </footer>
  );
}
