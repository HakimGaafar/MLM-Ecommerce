import Link from "next/link";
import { redirect } from "next/navigation";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { userHasSuperAdminRole } from "@/lib/require-super-admin-session";
import { requirePageAuth } from "@/lib/require-page-auth";
import AdminVendorFormListsForm from "./AdminVendorFormListsForm";

export default async function AdminVendorFormListsPage() {
  const session = await requirePageAuth("ADMIN");
  if (!userHasSuperAdminRole(session.roles)) redirect("/admin");

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminVendorFormLists;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-3xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/admin/settings" className="text-sm font-medium text-link">
          {ui.backToSettings}
        </Link>
      </div>
      <AdminVendorFormListsForm locale={locale} ui={ui} />
    </main>
  );
}
