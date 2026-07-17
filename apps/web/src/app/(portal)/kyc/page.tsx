import { getInternationalMarketingAgreementStatus } from "@mlm/domain";
import Link from "next/link";
import InternationalAgreementRecord from "@/components/international/InternationalAgreementRecord";
import KycDocumentsPanel from "@/components/kyc/KycDocumentsPanel";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { requirePageAuth } from "@/lib/require-page-auth";

export default async function CustomerKycPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.kyc;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const session = await requirePageAuth("CUSTOMER");
  const agreementStatus = await getInternationalMarketingAgreementStatus(session.sub);

  return (
    <main className="mx-auto w-full max-w-3xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.customerTitle}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.customerSubtitle}</p>
        </div>
        <Link href="/cashback" className="text-sm text-link font-medium">
          {ui.backToCashback}
        </Link>
      </div>
      {agreementStatus.exists ? (
        <div className="mt-8">
          <InternationalAgreementRecord
            accepted={agreementStatus.accepted}
            acceptedAt={agreementStatus.acceptedAt}
            version={agreementStatus.version}
            locale={locale}
            notice={dict.internationalNotices.affiliate}
            ui={{
              ...dict.agreementRecord,
              title: dict.agreementRecord.affiliateTitle,
            }}
            acceptHref="/affiliate"
          />
        </div>
      ) : null}
      <div className="mt-8">
        <KycDocumentsPanel
          apiBase="/api/v1/customer/kyc"
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
