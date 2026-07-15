import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import ReturnWizardClient from "@/app/customer/returns/ReturnWizardClient";
import {
  CustomerOrderNotFound,
  CustomerOrderWrongMarket,
  type CustomerOrderAccessUi,
} from "@/app/customer/orders/CustomerOrderAccessMessage";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { resolveCustomerOrderAccess } from "@/lib/customer-order-access";
import { getServerSession } from "@/lib/server-session";
import { getActiveMarket } from "@/lib/market-server";

export default async function ReturnStartPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role !== "CUSTOMER") {
    redirect("/dashboard");
  }

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const uiStart = dict.customerReturnStart;
  const uiReturns = dict.customerReturns;
  const reasonLabels = dict.orderReturnReason as Record<string, string>;
  const direction = locale === "ar" ? "rtl" : "ltr";

  if (!orderId?.trim()) {
    return (
      <main className="mx-auto max-w-lg p-8 animate-page-enter" dir={direction}>
        <p className="text-sm text-red-600 dark:text-red-400">{uiStart.missingOrder}</p>
        <Link href="/orders" className="mt-4 inline-block text-sm font-medium text-link">
          {uiStart.backToOrders}
        </Link>
      </main>
    );
  }

  const oid = orderId.trim();
  const market = await getActiveMarket();
  const access = await resolveCustomerOrderAccess({
    buyerUserId: session!.sub,
    orderId: oid,
    marketId: market.id,
    defaultCurrency: market.defaultCurrency,
  });

  const accessUi: CustomerOrderAccessUi = {
    wrongMarketTitle: dict.customerOrderDetail.wrongMarketTitle,
    wrongMarketBody: dict.customerOrderDetail.wrongMarketBody,
    notFoundTitle: dict.customerOrderDetail.notFoundTitle,
    notFoundBody: dict.customerOrderDetail.notFoundBody,
    switchToMarket: dict.customerOrderDetail.switchToMarket,
    backToOrders: dict.customerOrderDetail.backToOrders,
    switchError: dict.customerOrderDetail.switchError,
  };

  if (access.kind === "wrong_market") {
    return (
      <CustomerOrderWrongMarket
        locale={locale}
        homeMarket={access.homeMarket}
        returnTo={`/returns/new?orderId=${encodeURIComponent(oid)}`}
        ui={accessUi}
      />
    );
  }

  if (access.kind === "not_found") {
    return <CustomerOrderNotFound locale={locale} ui={accessUi} />;
  }

  const order = access.order;

  if (order.hasOpenReturn && order.activeReturnId) {
    redirect(`/returns/${order.activeReturnId}`);
  }

  if (!order.canRequestReturn) {
    return (
      <main className="mx-auto max-w-lg p-8 animate-page-enter" dir={direction}>
        <h1 className="text-2xl font-semibold">{uiStart.title}</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">{uiStart.notEligible}</p>
        <Link
          href={`/orders/${order.id}`}
          className="mt-6 btn-secondary btn-press"
        >
          {uiStart.backToOrder}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-8 animate-page-enter" dir={direction}>
      <h1 className="text-2xl font-semibold">{uiStart.title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{uiStart.intro}</p>

      <div className="mt-8">
        <ReturnWizardClient
          orderId={order.id}
          orderNo={order.orderNo}
          orderTotalAmount={order.totalAmount}
          currency={uiReturns.currency}
          locale={locale}
          ui={uiReturns}
          reasonLabels={reasonLabels}
        />
      </div>

      <Link
        href={`/orders/${order.id}`}
        className="mt-8 btn-secondary btn-press"
      >
        {uiStart.backToOrder}
      </Link>
    </main>
  );
}
