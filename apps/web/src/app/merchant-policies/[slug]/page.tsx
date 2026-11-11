import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_DOCUMENT_TITLES } from "@mlm/shared";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import {
  loadMerchantLegalPage,
  MERCHANT_POLICY_SLUG_MAP,
  type MerchantPolicySlug,
} from "@/lib/legal/load-merchant-legal-page";
import { getActiveMarket } from "@/lib/market-server";
import { getAppLocale } from "@/lib/ui-locale";

type PageProps = { params: Promise<{ slug: string }> };

function isMerchantSlug(slug: string): slug is MerchantPolicySlug {
  return slug in MERCHANT_POLICY_SLUG_MAP;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isMerchantSlug(slug)) return {};
  const locale = await getAppLocale();
  const titles = LEGAL_DOCUMENT_TITLES[MERCHANT_POLICY_SLUG_MAP[slug]];
  return { title: locale === "ar" ? titles.ar : titles.en };
}

export default async function MerchantPolicyPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isMerchantSlug(slug)) notFound();

  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const page = await loadMerchantLegalPage({
    slug,
    locale,
    marketId: market.id,
    marketCode: market.code,
  });
  if (!page) notFound();

  const ui = locale === "ar" ? ar.merchantPolicyStub : en.merchantPolicyStub;
  const legalUi = locale === "ar" ? ar.legalPages : en.legalPages;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const publishedLabel = page.publishedAt
    ? new Date(page.publishedAt).toLocaleDateString(locale === "ar" ? "ar" : "en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14" dir={direction}>
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {ui.version} {page.version}
            {page.isPublished && publishedLabel
              ? ` · ${legalUi.publishedOn} ${publishedLabel}`
              : ` · ${legalUi.draftNote}`}
            {` · ${page.marketCode}`}
          </p>
        </div>
        <Link href="/sell" className="text-sm font-medium text-link">
          {ui.backToSell}
        </Link>
      </div>

      <article className="space-y-8">
        {page.document.sections.map((section) => (
          <section key={section.id} className="space-y-3">
            {section.heading ? (
              <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            ) : null}
            {section.paragraphs?.map((paragraph, idx) => (
              <p
                key={`${section.id}-p-${idx}`}
                className="text-sm leading-7 text-[color-mix(in_srgb,var(--foreground)_92%,var(--muted))] sm:text-[0.95rem] sm:leading-8"
              >
                {paragraph}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <ul className="list-disc space-y-2 ps-5 text-sm leading-7 sm:text-[0.95rem]">
                {section.bullets.map((bullet, idx) => (
                  <li key={`${section.id}-b-${idx}`}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>
    </main>
  );
}
