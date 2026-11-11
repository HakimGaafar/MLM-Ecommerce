import Link from "next/link";
import { redirect } from "next/navigation";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { userHasSuperAdminRole } from "@/lib/require-super-admin-session";
import { requirePageAuth } from "@/lib/require-page-auth";
import AdminLegalFoundationsForm from "./AdminLegalFoundationsForm";

export default async function AdminLegalFoundationsPage() {
  const session = await requirePageAuth("ADMIN");
  if (!userHasSuperAdminRole(session.roles)) {
    redirect("/admin");
  }

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminLegalFoundations;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-medium">
          <Link href="/admin/markets" className="text-link">
            {ui.marketsLink}
          </Link>
          <Link href="/dashboard" className="text-link">
            {ui.backToDashboard}
          </Link>
        </div>
      </div>
      <AdminLegalFoundationsForm locale={locale} ui={ui.form} />
    </main>
  );
}
