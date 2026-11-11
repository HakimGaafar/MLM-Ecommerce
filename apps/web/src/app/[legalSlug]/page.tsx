import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalPolicyPageView from "@/components/legal/LegalPolicyPageView";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { isPublicLegalSlug } from "@/lib/legal/slugs";
import { loadPublicLegalPage } from "@/lib/legal/load-public-legal-page";
import type { PublicLegalSlug } from "@/lib/legal/types";
import { getActiveMarket } from "@/lib/market-server";
import { getAppLocale } from "@/lib/ui-locale";

type PageProps = {
  params: Promise<{ legalSlug: string }>;
};

export async function generateStaticParams() {
  return [
    { legalSlug: "about" },
    { legalSlug: "terms" },
    { legalSlug: "privacy" },
    { legalSlug: "returns-policy" },
    { legalSlug: "shipping-policy" },
    { legalSlug: "pricing-payment" },
    { legalSlug: "cashback-referral" },
  ];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { legalSlug } = await params;
  if (!isPublicLegalSlug(legalSlug)) return {};
  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const page = await loadPublicLegalPage({
    slug: legalSlug,
    locale,
    marketId: market.id,
    marketCode: market.code,
  });
  if (!page) return {};
  return {
    title: page.title,
    description: `${page.title} — VANDSOQ (${market.code})`,
  };
}

export default async function PublicLegalSlugPage({ params }: PageProps) {
  const { legalSlug } = await params;
  if (!isPublicLegalSlug(legalSlug)) notFound();

  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const page = await loadPublicLegalPage({
    slug: legalSlug as PublicLegalSlug,
    locale,
    marketId: market.id,
    marketCode: market.code,
  });
  if (!page) notFound();

  const dict = locale === "ar" ? ar : en;
  const ui = dict.legalPages;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <LegalPolicyPageView
      page={page}
      direction={direction}
      labels={{
        version: ui.version,
        draftNote: ui.draftNote,
        publishedOn: ui.publishedOn,
        otherPolicies: ui.otherPolicies,
        backHome: ui.backHome,
        policyLabels: ui.policyLabels,
      }}
    />
  );
}
