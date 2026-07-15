import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import ProfileForm from "./ProfileForm";
import ShippingAddressesPanel from "./ShippingAddressesPanel";

export default async function CustomerProfilePage() {
  const locale = await getCustomerPreferredLocale();
  const ui = locale === "ar" ? ar.customerProfile : en.customerProfile;
  const addrUi = locale === "ar" ? ar.customerShippingAddresses : en.customerShippingAddresses;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter" dir={direction}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{ui.title}</h1>
        <Link href="/dashboard" className="text-sm font-medium underline">
          {ui.backToDashboard}
        </Link>
      </div>

      <p className="mt-3 text-sm text-[var(--muted)]">
        {ui.subtitle}
      </p>

      <ProfileForm />
      <ShippingAddressesPanel locale={locale} ui={addrUi} />
    </main>
  );
}
