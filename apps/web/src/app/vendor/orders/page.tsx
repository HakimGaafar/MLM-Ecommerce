import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import VendorOrdersList from "./VendorOrdersList";

export default async function VendorOrdersPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.vendorOrders;
  const status = dict.orderStatus;
  const direction = locale === "ar" ? "rtl" : "ltr";

  const statusLabels = {
    NEW: status.NEW,
    PROCESSING: status.PROCESSING,
    SHIPPED: status.SHIPPED,
    COMPLETED: status.COMPLETED,
    CANCELLED: status.CANCELLED,
  };

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/dashboard" className="text-sm text-link font-medium">
          {ui.backToDashboard}
        </Link>
      </div>
      <VendorOrdersList
        locale={locale}
        ui={{
          ...ui.list,
          statusLabels,
          paymentLabels: ui.list.paymentLabels,
        }}
      />
    </main>
  );
}
