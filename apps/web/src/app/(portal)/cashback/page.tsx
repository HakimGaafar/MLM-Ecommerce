import Link from "next/link";
import { cookies } from "next/headers";
import CashbackView from "@/app/customer/cashback/CashbackView";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getServerSession } from "@/lib/server-session";

export default async function CashbackPage() {
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role !== "CUSTOMER") {
    return (
      <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter">
        <h1 className="text-2xl font-semibold">Cashback</h1>
        <p className="mt-3 text-[var(--muted)]">Cashback wallet is for customer accounts.</p>
      </main>
    );
  }

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = {
    ...dict.customerCashback,
    statusLabels: dict.ledgerStatus as Record<string, string>,
  };
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-link">
          {ui.backToDashboard}
        </Link>
      </div>

      <CashbackView locale={locale} ui={ui} />
    </main>
  );
}
