import type { Metadata } from "next";
import Image from "next/image";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { SocialIcon } from "@/components/SiteFooter";
import { BRAND_LINKS, BRAND_LOGO_PATH, getBrandName } from "@/lib/brand";
import { getAppLocale } from "@/lib/ui-locale";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Fources customer support and find our headquarters in Oman.",
};

export default async function ContactPage() {
  const locale = await getAppLocale();
  const ui = locale === "ar" ? ar.contactPage : en.contactPage;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const brandName = getBrandName(locale);

  const socialLinks = [
    { label: "Facebook", href: BRAND_LINKS.facebook, icon: "facebook" },
    { label: "Instagram", href: BRAND_LINKS.instagram, icon: "instagram" },
    { label: "YouTube", href: BRAND_LINKS.youtube, icon: "youtube" },
    { label: "X", href: BRAND_LINKS.x, icon: "x" },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14" dir={direction}>
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
            <Image
              src={BRAND_LOGO_PATH}
              alt={`${brandName} logo`}
              width={517}
              height={358}
              priority
              className="h-auto w-48 rounded-xl bg-white p-3 sm:w-56"
            />
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              {ui.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{ui.title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              {ui.subtitle}
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              {ui.headquarters}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{ui.oman}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{ui.locationText}</p>
            <a
              href={BRAND_LINKS.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary mt-4 inline-flex"
            >
              {ui.openMaps}
            </a>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
            <h2 className="font-semibold">{ui.followUs}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label}
                  aria-label={link.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] shadow-sm transition hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] hover:text-[var(--primary)]"
                >
                  <SocialIcon name={link.icon} />
                </a>
              ))}
            </div>
          </section>
        </div>

        <ContactForm locale={locale} ui={ui} />
      </div>
    </main>
  );
}
