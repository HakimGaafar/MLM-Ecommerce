import VendorSetupForm from "@/app/vendor/setup/VendorSetupForm";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";

export default async function VendorSetupPage() {
  const locale = await getCustomerPreferredLocale();
  const ui = locale === "ar" ? ar.vendorSetup : en.vendorSetup;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-3xl p-8 animate-page-enter" dir={direction}>
      <h1 className="text-2xl font-semibold">{ui.title}</h1>
      <p className="mt-2 text-[var(--muted)]">{ui.subtitle}</p>
      <VendorSetupForm locale={locale} ui={ui} />
    </main>
  );
}
