import Link from "next/link";
import AdminVendorPermissionsForm from "@/app/admin/vendors/[id]/permissions/AdminVendorPermissionsForm";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";

export default async function AdminVendorPermissionsPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const locale = await getCustomerPreferredLocale();
  const ui = locale === "ar" ? ar.adminVendorPermissions : en.adminVendorPermissions;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-3xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/admin/vendors" className="text-sm font-medium text-link">
          {ui.backToVendors}
        </Link>
      </div>
      <AdminVendorPermissionsForm vendorId={id} locale={locale} ui={ui} />
    </main>
  );
}
