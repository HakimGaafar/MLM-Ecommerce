import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import ReturnsListContent from "./ReturnsListContent";

export default async function CustomerReturnsPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.customerReturns;
  const reasonLabels = dict.orderReturnReason as Record<string, string>;
  const statusLabels = dict.orderReturnStatus as Record<string, string>;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <PageShell dir={direction} maxWidth="5xl">
      <PageHeader
        title={ui.listTitle}
        subtitle={ui.listSubtitle}
        actions={
          <Link href="/dashboard" className="text-link text-sm font-medium">
            {ui.backToDashboard}
          </Link>
        }
      />
      <ReturnsListContent
        locale={locale}
        ui={ui}
        reasonLabels={reasonLabels}
        statusLabels={statusLabels}
      />
    </PageShell>
  );
}
