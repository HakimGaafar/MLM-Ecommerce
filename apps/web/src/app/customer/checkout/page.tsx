import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { Suspense } from "react";
import CheckoutView from "./CheckoutView";

export default async function CustomerCheckoutPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.customerCheckout;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <PageShell dir={direction} maxWidth="5xl">
      <PageHeader title={ui.title} subtitle={ui.subtitle} />
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">{ui.loading}</p>}>
        <CheckoutView locale={locale} ui={ui} toastOrderPlaced={dict.toast.orderPlaced} />
      </Suspense>
    </PageShell>
  );
}
