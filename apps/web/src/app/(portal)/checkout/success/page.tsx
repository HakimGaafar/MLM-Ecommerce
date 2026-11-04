import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getPaymentGateway, StripeCheckoutError, TapCheckoutError } from "@mlm/domain";
import { cookies } from "next/headers";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getServerSession } from "@/lib/server-session";
import { logger } from "@/lib/logger";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; tap_id?: string }>;
}) {
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.customerCheckoutSuccess;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const params = await searchParams;
  const providerReference = params.tap_id?.trim() || params.session_id?.trim();

  if (role !== "CUSTOMER" || !session?.sub) {
    return (
      <PageShell dir={direction} maxWidth="3xl">
        <PageHeader title={ui.title} subtitle={ui.signInHint} />
        <Link href="/account/customer" className="btn-primary mt-6 inline-flex">
          {ui.signInLink}
        </Link>
      </PageShell>
    );
  }

  if (!providerReference) {
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
    const result = await getPaymentGateway().confirmCheckoutForBuyer(session.sub, providerReference);
    orderId = result.orderId;
  } catch (error) {
    const code =
      error instanceof TapCheckoutError || error instanceof StripeCheckoutError
        ? error.code
        : null;

    if (code === "AMOUNT_MISMATCH_REFUNDED" || code === "AMOUNT_MISMATCH") {
      logger.warn(
        { buyerUserId: session.sub, providerReference, code },
        "checkout success amount mismatch — charge refunded, order not created",
      );
      return (
        <PageShell dir={direction} maxWidth="3xl">
          <PageHeader title={ui.title} subtitle={ui.amountMismatchRefundedTitle} />
          <p className="mt-4 text-sm text-[var(--muted)]">{ui.amountMismatchRefundedBody}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {ui.amountMismatchReference}: {providerReference}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/checkout" className="btn-primary inline-flex">
              {ui.backToCheckout}
            </Link>
            <Link href="/orders" className="btn-secondary inline-flex">
              {ui.viewOrders}
            </Link>
          </div>
        </PageShell>
      );
    }

    if (code === "AMOUNT_MISMATCH_REFUND_FAILED") {
      logger.error(
        { buyerUserId: session.sub, providerReference, code },
        "checkout success amount mismatch — automatic refund failed",
      );
      return (
        <PageShell dir={direction} maxWidth="3xl">
          <PageHeader title={ui.title} subtitle={ui.amountMismatchRefundFailedTitle} />
          <p className="mt-4 text-sm text-[var(--muted)]">{ui.amountMismatchRefundFailedBody}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {ui.amountMismatchReference}: {providerReference}
          </p>
          <Link href="/orders" className="btn-secondary mt-6 inline-flex">
            {ui.viewOrders}
          </Link>
        </PageShell>
      );
    }

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
