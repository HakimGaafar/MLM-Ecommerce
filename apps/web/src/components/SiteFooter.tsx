import Link from "next/link";
import Image from "next/image";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getAppLocale } from "@/lib/ui-locale";
import { BRAND_LINKS, BRAND_LOGO_PATH, getBrandName } from "@/lib/brand";

export function SocialIcon({
  name,
}: {
  name: "facebook" | "instagram" | "youtube" | "x" | "maps";
}) {
  const common = {
    className: "h-4 w-4",
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": true,
  } as const;

  if (name === "facebook") {
    return (
      <svg {...common}>
        <path d="M13.5 21v-8h2.75l.41-3.2H13.5V7.76c0-.93.26-1.56 1.59-1.56h1.7V3.34a22.7 22.7 0 0 0-2.47-.13c-2.45 0-4.12 1.49-4.12 4.23V9.8H7.43V13h2.77v8h3.3Z" />
      </svg>
    );
  }
  if (name === "instagram") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "youtube") {
    return (
      <svg {...common}>
        <path d="M21.58 7.19a2.99 2.99 0 0 0-2.1-2.12C17.63 4.57 12 4.57 12 4.57s-5.63 0-7.48.5a2.99 2.99 0 0 0-2.1 2.12A31.2 31.2 0 0 0 1.92 12c0 1.63.14 3.25.5 4.81a2.99 2.99 0 0 0 2.1 2.12c1.85.5 7.48.5 7.48.5s5.63 0 7.48-.5a2.99 2.99 0 0 0 2.1-2.12c.36-1.56.5-3.18.5-4.81s-.14-3.25-.5-4.81ZM9.9 15.2V8.8l5.45 3.2-5.45 3.2Z" />
      </svg>
    );
  }
  if (name === "x") {
    return (
      <svg {...common}>
        <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.74-8.85L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export default async function SiteFooter({ compact = false }: { compact?: boolean }) {
  const locale = await getAppLocale();
  const f = locale === "ar" ? ar.siteFooter : en.siteFooter;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const year = new Date().getFullYear();
  const appName = getBrandName(locale);

  const socialUrl = (envKey: string, fallback: string) => {
    const fromEnv = process.env[envKey]?.trim();
    const href = (fromEnv && fromEnv.startsWith("http") ? fromEnv : fallback).trim();
    return href.startsWith("http") ? href : "";
  };

  const social = [
    { href: socialUrl("NEXT_PUBLIC_SOCIAL_FACEBOOK", BRAND_LINKS.facebook), icon: "facebook", title: "Facebook" },
    { href: socialUrl("NEXT_PUBLIC_SOCIAL_INSTAGRAM", BRAND_LINKS.instagram), icon: "instagram", title: "Instagram" },
    { href: socialUrl("NEXT_PUBLIC_SOCIAL_YOUTUBE", BRAND_LINKS.youtube), icon: "youtube", title: "YouTube" },
    { href: socialUrl("NEXT_PUBLIC_SOCIAL_X", BRAND_LINKS.x), icon: "x", title: "X" },
    { href: BRAND_LINKS.maps, icon: "maps", title: f.location },
  ].filter((s) => s.href.length > 0);

  const essential = [
    { href: "/", label: f.home },
    { href: "/products", label: f.shop },
    { href: "/stores", label: f.storeList },
    { href: "/contact", label: f.contact },
    { href: "/sell", label: f.becomeSeller, accent: true },
  ];


  return (
    <footer
      className="site-footer mt-auto border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_88%,var(--background))] backdrop-blur-sm"
      dir={direction}
    >
      <div className={compact ? "mx-auto max-w-6xl px-4 py-3 sm:px-6" : "mx-auto max-w-6xl px-4 py-5 sm:px-6"}>
        <div
          className={`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between ${compact ? "lg:gap-3" : "lg:gap-4"}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:flex-nowrap">
              <Image
                src={BRAND_LOGO_PATH}
                alt=""
                width={68}
                height={47}
                className="h-8 w-auto rounded bg-white object-contain p-0.5"
              />
              <span className="font-semibold text-[var(--foreground)]">{appName}</span>
              {!compact ? (
                <span className="text-xs font-normal text-[var(--muted)] lg:whitespace-nowrap">
                  {f.tagline}
                </span>
              ) : null}
            </div>
          </div>

          <nav
            className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm lg:flex-nowrap"
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
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] shadow-sm transition hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] hover:text-[var(--primary)]"
                  >
                    <span className="sr-only">{s.title}</span>
                    <SocialIcon name={s.icon as "facebook" | "instagram" | "youtube" | "x" | "maps"} />
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
