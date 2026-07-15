import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import CartView from "./CartView";

export default async function CustomerCartPage() {
  const locale = await getCustomerPreferredLocale();
  const ui = locale === "ar" ? ar.customerCart : en.customerCart;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <PageShell dir={direction} maxWidth="5xl">
      <PageHeader
        title={ui.title}
        subtitle={ui.subtitle}
        actions={
          <>
            <Link href="/dashboard" className="text-link text-sm font-medium">
              {ui.backToDashboard}
            </Link>
            <Link href="/products" className="text-link text-sm font-medium">
              {ui.continueShopping}
            </Link>
          </>
        }
      />
      <CartView locale={locale} ui={ui} />
    </PageShell>
  );
}
