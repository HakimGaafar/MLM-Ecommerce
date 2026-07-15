import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import VendorOperationsView from "./VendorOperationsView";

export default async function VendorOperationsPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = {
    ...dict.vendorOperations,
    statusLabels: dict.ledgerStatus as Record<string, string>,
    entryTypeLabels: dict.vendorPayout.entryTypeLabels as Record<string, string>,
    kindLabels: dict.vendorPayout.kindLabels as Record<string, string>,
    reversedHint: dict.vendorPayout.reversedHint,
    orderRef: dict.vendorPayout.orderRef,
  };
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <PageShell dir={direction} maxWidth="5xl">
      <PageHeader
        title={ui.title}
        subtitle={ui.subtitle}
        actions={
          <Link href="/dashboard" className="text-link text-sm font-medium">
            {ui.backToDashboard}
          </Link>
        }
      />
      <VendorOperationsView locale={locale} ui={ui} />
    </PageShell>
  );
}
