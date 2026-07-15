import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { confirmStripeCheckoutForBuyer } from "@mlm/domain";
import { cookies } from "next/headers";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getServerSession } from "@/lib/server-session";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.customerCheckoutSuccess;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const params = await searchParams;
  const sessionId = params.session_id?.trim();

  if (role !== "CUSTOMER" || !session?.sub) {
    return (
      <PageShell dir={direction} maxWidth="3xl">
        <PageHeader title={ui.title} subtitle={ui.signInHint} />
        <Link href="/login" className="btn-primary mt-6 inline-flex">
          {ui.signInLink}
        </Link>
      </PageShell>
    );
  }

  if (!sessionId) {
    return (
      <PageShell dir={direction} maxWidth="3xl">
        <PageHeader title={ui.title} subtitle={ui.missingSession} />
        <Link href="/checkout" className="btn-secondary mt-6 inline-flex">
          {ui.backToCheckout}
        </Link>
      </PageShell>
    );
  }

  let orderId: string | null = null;
  try {
    const result = await confirmStripeCheckoutForBuyer(session.sub, sessionId);
    orderId = result.orderId;
  } catch {
    return (
      <PageShell dir={direction} maxWidth="3xl">
        <PageHeader title={ui.title} subtitle={ui.confirmError} />
        <p className="mt-4 text-sm text-[var(--muted)]">{ui.confirmErrorHint}</p>
        <Link href="/orders" className="btn-secondary mt-6 inline-flex">
          {ui.viewOrders}
        </Link>
      </PageShell>
    );
  }

  redirect(`/orders/${orderId}`);
}
