import Link from "next/link";
import { redirect } from "next/navigation";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { requirePageAuth } from "@/lib/require-page-auth";
import { userHasSuperAdminRole } from "@/lib/require-super-admin-session";
import AdminContactInquiriesList from "./AdminContactInquiriesList";

export default async function AdminContactInquiriesPage() {
  const session = await requirePageAuth("ADMIN");
  if (!userHasSuperAdminRole(session.roles)) redirect("/admin");

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminContactInquiries;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-5xl p-5 sm:p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-link">
          {ui.backToDashboard}
        </Link>
      </div>
      <AdminContactInquiriesList locale={locale} ui={ui} />
    </main>
  );
}
