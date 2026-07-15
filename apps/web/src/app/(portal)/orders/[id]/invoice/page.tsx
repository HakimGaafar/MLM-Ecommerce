import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OrderSummaryUnavailable from "@/app/customer/orders/[id]/OrderSummaryUnavailable";
import OrderSummaryView from "@/app/customer/orders/[id]/OrderSummaryView";
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

export default async function OrderInvoicePage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role !== "CUSTOMER") {
    redirect("/dashboard");
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
        returnTo={`/orders/${id}/invoice`}
        ui={accessUi}
      />
    );
  }

  if (access.kind === "not_found") {
    return <CustomerOrderNotFound locale={locale} ui={accessUi} />;
  }

  const order = access.order;
  const inv = dict.customerOrderInvoice;
  const detail = dict.customerOrderDetail;
  const stepLabels = dict.customerOrderStep as Record<string, string>;

  if (!order.invoiceEligible) {
    return (
      <OrderSummaryUnavailable
        orderId={id}
        locale={locale}
        title={inv.title}
        message={inv.notEligibleBody}
        backToOrder={inv.backToOrder}
      />
    );
  }

  if (!order.finalInvoiceAllowed) {
    return (
      <OrderSummaryUnavailable
        orderId={id}
        locale={locale}
        title={inv.title}
        message={inv.gateClosedBody}
        backToOrder={inv.backToOrder}
      />
    );
  }

  const ui = {
    ...inv,
    paymentCod: detail.paymentCod,
    paymentOnlineCard: detail.paymentOnlineCard,
    paymentWalletCovered: detail.paymentWalletCovered,
    paymentPending: detail.paymentPending,
    paymentPaid: detail.paymentPaid,
    paymentFailed: detail.paymentFailed,
    paymentRefunded: detail.paymentRefunded,
    paymentMethodLabel: detail.paymentMethodLabel,
    paymentStatusLabel: detail.paymentStatusLabel,
  };

  return (
    <OrderSummaryView
      order={order}
      locale={locale}
      ui={ui}
      stepLabel={stepLabels[order.customerStep] ?? order.customerStep}
    />
  );
}
