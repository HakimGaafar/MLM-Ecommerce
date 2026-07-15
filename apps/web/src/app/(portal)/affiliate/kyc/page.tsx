import Link from "next/link";
import KycDocumentsPanel from "@/components/kyc/KycDocumentsPanel";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";

export default async function AffiliateKycPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.kyc;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-3xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.affiliateTitle}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.affiliateSubtitle}</p>
        </div>
        <Link href="/affiliate" className="text-sm text-link font-medium">
          {ui.backToAffiliate}
        </Link>
      </div>
      <div className="mt-8">
        <KycDocumentsPanel
          apiBase="/api/v1/affiliate/kyc"
          locale={locale}
          ui={{
            ...ui.panel,
            documentTypes: ui.documentTypes,
            statusLabels: ui.statusLabels,
          }}
        />
      </div>
    </main>
  );
}
