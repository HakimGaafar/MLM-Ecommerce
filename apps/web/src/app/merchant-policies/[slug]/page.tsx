import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DEFAULT_LEGAL_POLICY_VERSION,
  LEGAL_DOCUMENT_TITLES,
  type LegalDocumentType,
} from "@mlm/shared";
import { getPublicLegalPageMeta } from "@mlm/domain";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getActiveMarket } from "@/lib/market-server";
import { getAppLocale } from "@/lib/ui-locale";

const SLUG_MAP: Record<string, LegalDocumentType> = {
  cooperation: "MERCHANT_COOPERATION",
  operational: "MERCHANT_OPERATIONAL",
  commission: "MERCHANT_COMMISSION",
  "data-confirmation": "MERCHANT_DATA_CONFIRMATION",
};

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const documentType = SLUG_MAP[slug];
  if (!documentType) return {};
  const locale = await getAppLocale();
  const titles = LEGAL_DOCUMENT_TITLES[documentType];
  return { title: locale === "ar" ? titles.ar : titles.en };
}

export default async function MerchantPolicyStubPage({ params }: PageProps) {
  const { slug } = await params;
  const documentType = SLUG_MAP[slug];
  if (!documentType) notFound();

  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const meta = await getPublicLegalPageMeta(market.id, documentType);
  const titles = LEGAL_DOCUMENT_TITLES[documentType];
  const title = locale === "ar" ? titles.ar : titles.en;
  const ui = locale === "ar" ? ar.merchantPolicyStub : en.merchantPolicyStub;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const version = meta?.version ?? DEFAULT_LEGAL_POLICY_VERSION;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14" dir={direction}>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {ui.version} {version} · {market.code}
          </p>
        </div>
        <Link href="/sell" className="text-sm font-medium text-link">
          {ui.backToSell}
        </Link>
      </div>
      <article className="space-y-4 text-sm leading-7">
        <p>{ui.intro}</p>
        <p className="text-[var(--muted)]">{ui.phaseNote}</p>
      </article>
    </main>
  );
}
