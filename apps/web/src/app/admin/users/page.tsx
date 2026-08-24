import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { userHasSuperAdminRole } from "@/lib/require-super-admin-session";
import { requirePageAuth } from "@/lib/require-page-auth";
import AdminUsersList from "./AdminUsersList";

export default async function AdminUsersPage() {
  const session = await requirePageAuth("ADMIN");
  const roles = session.roles ?? [];
  const canPromote = userHasSuperAdminRole(roles);

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminUsers;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/dashboard" className="text-sm text-link font-medium">
          {ui.backToDashboard}
        </Link>
      </div>
      <div className="mt-8">
        <AdminUsersList
          locale={locale}
          canPromote={canPromote}
          currentUserId={session.sub}
          ui={{
            ...ui.list,
            statusLabels: dict.userStatus as Record<string, string>,
          }}
        />
      </div>
    </main>
  );
}
