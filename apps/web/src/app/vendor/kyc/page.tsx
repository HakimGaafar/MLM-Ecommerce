import {
  getInternationalSalesAgreementStatus,
  resolveVendorAccessForUser,
} from "@mlm/domain";
import Link from "next/link";
import InternationalAgreementRecord from "@/components/international/InternationalAgreementRecord";
import KycDocumentsPanel from "@/components/kyc/KycDocumentsPanel";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getActiveMarket } from "@/lib/market-server";
import { requirePageAuth } from "@/lib/require-page-auth";

export default async function VendorKycPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.kyc;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const session = await requirePageAuth("VENDOR");
  const market = await getActiveMarket();
  const access = await resolveVendorAccessForUser(session.sub, market.id);
  const agreementStatus =
    market.code === "GLOBAL" && access
      ? await getInternationalSalesAgreementStatus(access.vendorId)
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.vendorTitle}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.vendorSubtitle}</p>
        </div>
        <Link href="/vendor/payout" className="text-sm text-link font-medium">
          {ui.backToPayout}
        </Link>
      </div>
      {agreementStatus ? (
        <div className="mt-8">
          <InternationalAgreementRecord
            accepted={agreementStatus.accepted}
            acceptedAt={agreementStatus.acceptedAt}
            version={agreementStatus.version}
            locale={locale}
            notice={dict.internationalNotices.vendor}
            ui={{
              ...dict.agreementRecord,
              title: dict.agreementRecord.vendorTitle,
            }}
            acceptHref="/vendor/products"
          />
        </div>
      ) : null}
      <div className="mt-8">
        <KycDocumentsPanel
          apiBase="/api/v1/vendor/kyc"
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
