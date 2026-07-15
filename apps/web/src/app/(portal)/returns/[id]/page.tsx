import { getCustomerReturnDetail } from "@mlm/domain";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ReturnDetailContent from "@/app/customer/returns/ReturnDetailContent";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getServerSession } from "@/lib/server-session";

export default async function ReturnDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role !== "CUSTOMER") {
    return (
      <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter">
        <h1 className="text-2xl font-semibold">Returns</h1>
        <p className="mt-3 text-[var(--muted)]">Returns for this role are not implemented yet.</p>
      </main>
    );
  }

  const ret = await getCustomerReturnDetail(session!.sub, id);
  if (!ret) {
    notFound();
  }

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.customerReturns;
  const reasonLabels = dict.orderReturnReason as Record<string, string>;
  const statusLabels = dict.orderReturnStatus as Record<string, string>;

  return (
    <ReturnDetailContent
      ret={ret}
      locale={locale}
      ui={ui}
      reasonLabels={reasonLabels}
      statusLabels={statusLabels}
    />
  );
}
