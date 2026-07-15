import Link from "next/link";
import { affiliateRankTitles } from "@mlm/domain";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import AdminAffiliateDetailView from "./AdminAffiliateDetailView";

export default async function AdminAffiliateDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminAffiliateDetail;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter" dir={direction}>
      <Link href="/admin/affiliates" className="text-sm font-medium text-link">
        {ui.backToList}
      </Link>
      <AdminAffiliateDetailView
        userId={userId}
        locale={locale}
        ui={ui}
        ranks={affiliateRankTitles}
        settlementsUi={{
          ...dict.adminSettlements.panel,
          entryTypeLabels: dict.customerCashback.entryTypeLabels as Record<string, string>,
        }}
      />
    </main>
  );
}
