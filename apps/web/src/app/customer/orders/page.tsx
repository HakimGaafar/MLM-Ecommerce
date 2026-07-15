import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import OrdersView from "./OrdersView";

export default async function CustomerOrdersPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.customerOrders;
  const stepLabels = dict.customerOrderStep as Record<string, string>;
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
      <OrdersView locale={locale} ui={ui} stepLabels={stepLabels} />
    </PageShell>
  );
}
