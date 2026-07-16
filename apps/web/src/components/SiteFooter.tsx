import Link from "next/link";
import Image from "next/image";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getAppLocale } from "@/lib/ui-locale";
import { BRAND_LINKS, BRAND_LOGO_PATH, getBrandName } from "@/lib/brand";

export function SocialIcon({
  name,
}: {
  name: "facebook" | "instagram" | "youtube" | "x" | "maps" | "whatsapp";
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

  if (name === "whatsapp") {
    return (
      <svg
        className="h-4 w-4"
        viewBox="0 0 448 512"
        fill="currentColor"
        aria-hidden
      >
        <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
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
    { href: BRAND_LINKS.whatsapp, icon: "whatsapp", title: "WhatsApp" },
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
                    <SocialIcon
                      name={s.icon as "facebook" | "instagram" | "youtube" | "x" | "whatsapp" | "maps"}
                    />
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
