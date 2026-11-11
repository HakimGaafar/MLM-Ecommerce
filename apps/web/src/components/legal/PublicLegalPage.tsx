import { notFound } from "next/navigation";
import LegalPolicyPageView from "@/components/legal/LegalPolicyPageView";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { loadPublicLegalPage } from "@/lib/legal/load-public-legal-page";
import type { PublicLegalSlug } from "@/lib/legal/types";
import { getActiveMarket } from "@/lib/market-server";
import { getAppLocale } from "@/lib/ui-locale";

export async function PublicLegalPage({ slug }: { slug: PublicLegalSlug }) {
  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const page = await loadPublicLegalPage({
    slug,
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

export async function publicLegalMetadata(slug: PublicLegalSlug) {
  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const page = await loadPublicLegalPage({
    slug,
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
