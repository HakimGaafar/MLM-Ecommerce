import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OrderDetailContent from "@/app/customer/orders/[id]/OrderDetailContent";
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

export default async function OrderDetailPage({
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
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="mt-3 text-[var(--muted)]">
          Order details for this role are not implemented yet.
        </p>
      </main>
    );
  }

  const market = await getActiveMarket();
  const access = await resolveCustomerOrderAccess({
    buyerUserId: session!.sub,
    orderId: id,
    marketId: market.id,
    defaultCurrency: market.defaultCurrency,
  });

  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
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
        returnTo={`/orders/${id}`}
        ui={accessUi}
      />
    );
  }

  if (access.kind === "not_found") {
    return <CustomerOrderNotFound locale={locale} ui={accessUi} />;
  }

  const order = access.order;
  const detail = dict.customerOrderDetail;
  const orders = dict.customerOrders;
  const stepLabels = dict.customerOrderStep as Record<string, string>;

  const ui = {
    ...detail,
    currency: orders.currency,
  };

  const lineRatingUi = dict.customerOrderLineRating;

  const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim() || null;

  return (
    <OrderDetailContent
      order={order}
      locale={locale}
      ui={ui}
      stepLabels={stepLabels}
      supportUrl={supportUrl}
      lineRatingUi={lineRatingUi}
      unitStatusLabels={dict.orderUnitStatus as Record<string, string>}
      invoiceUi={dict.customerOrderInvoices}
    />
  );
}
