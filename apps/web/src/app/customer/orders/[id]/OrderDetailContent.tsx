import Link from "next/link";
import type { CustomerOrderDetailDto, CustomerOrderLineItemDto } from "@mlm/domain";
import OrderDeliveryAddressCard from "@/components/orders/OrderDeliveryAddressCard";
import OrderDeliveryStepper from "@/components/orders/OrderDeliveryStepper";
import OrderInvoiceRow from "@/components/orders/OrderInvoiceRow";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { formatMoney } from "@/lib/format-currency";
import type { OrderDeliveryStepId } from "@/lib/order-delivery-steps";
import LineItemRatingBlock, { type LineItemRatingUi } from "./LineItemRatingBlock";
import OrderInvoiceTiles from "./OrderInvoiceTiles";

type Locale = "en" | "ar";

type OrderDetailUi = {
  title: string;
  backToOrders: string;
  status: string;
  summary: string;
  subtotal: string;
  shippingFee: string;
  discount: string;
  vat: string;
  grandTotal: string;
  orderedOn: string;
  new: string;
  processing: string;
  shipped: string;
  completed: string;
  cancelled: string;
  currency: string;
  itemsTitle: string;
  vendor: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  unitLabel: string;
  unitStatus: string;
  noItems: string;
  platformNoticeTitle: string;
  delayNoticeBody: string;
  unitCancelled: string;
  paymentTitle: string;
  paymentMethodLabel: string;
  paymentStatusLabel: string;
  paymentCod: string;
  paymentOnlineCard: string;
  paymentWalletCovered: string;
  paymentPending: string;
  paymentPaid: string;
  paymentFailed: string;
  paymentRefunded: string;
  walletAppliedLabel: string;
  remainingDueLabel: string;
  shippingTitle: string;
  shippingLegacy: string;
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
  trackingProgress: string;
  deliveryTitle: string;
  deliveryCancelled: string;
  deliveryStepHints: Record<OrderDeliveryStepId, string>;
  addressTitle: string;
  invoiceRowTitle: string;
  invoiceRowViewSummary: string;
  invoiceRowPending: string;
  invoiceRowNotEligible: string;
  deliveredOn: string;
  actionsTitle: string;
  requestReturn: string;
  contactSupport: string;
  returnWindowHint: string;
  viewOpenReturn: string;
};

type InvoiceTilesUi = {
  title: string;
  orderSummary: string;
  downloadVendorInvoice: string;
  unavailable: string;
  gateClosed: string;
  orderNotEligible: string;
  profileIncomplete: string;
  loading: string;
  loadError: string;
  downloadError: string;
  downloading: string;
};

function paymentMethodText(ui: OrderDetailUi, method: string): string {
  switch (method) {
    case "COD":
      return ui.paymentCod;
    case "ONLINE_CARD":
      return ui.paymentOnlineCard;
    case "WALLET_COVERED":
      return ui.paymentWalletCovered;
    default:
      return method;
  }
}

function paymentStatusText(ui: OrderDetailUi, status: string): string {
  switch (status) {
    case "PENDING":
      return ui.paymentPending;
    case "PAID":
      return ui.paymentPaid;
    case "FAILED":
      return ui.paymentFailed;
    case "REFUNDED":
      return ui.paymentRefunded;
    default:
      return status;
  }
}

function formatOrderedAt(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function noticeBodyForLocale(
  notice: { type: string; body: string },
  locale: Locale,
  delayNoticeBody: string,
): string {
  if (notice.type === "DELAY" && locale === "ar") {
    return delayNoticeBody;
  }
  return notice.body;
}

function groupLineItemsByVendor(items: CustomerOrderLineItemDto[]): [string, CustomerOrderLineItemDto[]][] {
  const map = new Map<string, CustomerOrderLineItemDto[]>();
  for (const item of items) {
    const key = item.vendorName;
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return Array.from(map.entries());
}

export default function OrderDetailContent({
  order,
  locale,
  ui,
  stepLabels,
  supportUrl,
  lineRatingUi,
  unitStatusLabels,
  invoiceUi,
}: {
  order: CustomerOrderDetailDto;
  locale: Locale;
  ui: OrderDetailUi;
  stepLabels: Record<string, string>;
  supportUrl: string | null;
  lineRatingUi: LineItemRatingUi;
  unitStatusLabels: Record<string, string>;
  invoiceUi: InvoiceTilesUi;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const vendorGroups = groupLineItemsByVendor(order.lineItems);
  const ship = order.shipping;
  const supportHref = supportUrl?.trim() || undefined;
  const deliveredOnFormatted = order.deliveredAt
    ? formatOrderedAt(order.deliveredAt, locale)
    : null;

  return (
    <PageShell dir={direction} maxWidth="5xl">
      <PageHeader
        title={ui.title}
        subtitle={`${order.orderNo} · ${ui.orderedOn}: ${formatOrderedAt(order.createdAt, locale)}`}
        actions={
          <Link href="/orders" className="text-link text-sm font-medium">
            {ui.backToOrders}
          </Link>
        }
      />

      {order.customerNotices.length > 0 ? (
        <ul className="mb-6 space-y-2">
          {order.customerNotices.map((notice) => (
            <li
              key={notice.id}
              className="rounded-xl border border-emerald-500/50 bg-emerald-500/18 px-4 py-3 text-base font-bold text-emerald-100"
            >
              <p className="text-sm font-extrabold uppercase tracking-wide text-emerald-200">
                {ui.platformNoticeTitle}
              </p>
              <p className="mt-1 whitespace-pre-wrap">
                {noticeBodyForLocale(notice, locale, ui.delayNoticeBody)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-4">
        <OrderDeliveryStepper
          customerStep={order.customerStep}
          locale={locale}
          title={ui.deliveryTitle}
          stepLabels={stepLabels}
          stepHints={ui.deliveryStepHints}
          deliveredOn={deliveredOnFormatted}
          deliveredOnLabel={ui.deliveredOn}
          cancelledMessage={ui.deliveryCancelled}
        />

        <OrderDeliveryAddressCard
          shipping={ship}
          locale={locale}
          title={ui.addressTitle}
          legacyMessage={ui.shippingLegacy}
          recipientLabel={ui.recipientName}
        />

        <OrderInvoiceRow
          orderId={order.id}
          invoiceEligible={order.invoiceEligible}
          finalInvoiceAllowed={order.finalInvoiceAllowed}
          title={ui.invoiceRowTitle}
          viewSummary={ui.invoiceRowViewSummary}
          pendingMessage={ui.invoiceRowPending}
          notEligibleMessage={ui.invoiceRowNotEligible}
        />
      </div>

      <section className="app-card mt-6 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.actionsTitle}</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {order.hasOpenReturn && order.activeReturnId ? (
            <Link
              href={`/returns/${order.activeReturnId}`}
              className="btn-primary btn-press"
            >
              {ui.viewOpenReturn}
            </Link>
          ) : order.canRequestReturn ? (
            <Link
              href={`/returns/new?orderId=${encodeURIComponent(order.id)}`}
              className="btn-primary btn-press"
            >
              {ui.requestReturn}
            </Link>
          ) : supportHref ? (
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary btn-press"
            >
              {ui.contactSupport}
            </a>
          ) : (
            <span className="inline-flex rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-2 text-sm text-[var(--muted)]">
              {ui.contactSupport}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">{ui.returnWindowHint}</p>
      </section>

      <section className="app-card mt-6 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {ui.itemsTitle}
        </h2>
        {order.lineItems.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">{ui.noItems}</p>
        ) : (
          <div className="mt-4 space-y-8">
            {vendorGroups.map(([vendorName, lines]) => (
              <div key={vendorName}>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {ui.vendor}: {vendorName}
                </h3>
                <ul className="mt-3 divide-y divide-[var(--border)]">
                  {lines.map((line) => (
                    <li key={line.id} className="flex flex-col gap-2 py-4 first:pt-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{line.productName}</p>
                          {line.unitLabel ? (
                            <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                              {ui.unitLabel}: {line.unitLabel}
                            </p>
                          ) : null}
                          {line.unitStatus && line.unitStatus !== "ACTIVE" ? (
                            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                              {ui.unitStatus}: {unitStatusLabels[line.unitStatus] ?? line.unitStatus}
                            </p>
                          ) : null}
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {ui.quantity}: {line.quantity} · {ui.unitPrice}: {formatMoney(line.unitPrice, order.currency, locale)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums sm:text-end">
                          {ui.lineTotal}: {formatMoney(line.lineTotal, order.currency, locale)}
                        </p>
                      </div>
                      <LineItemRatingBlock
                        key={`${line.id}-${line.rating?.updatedAt ?? "none"}`}
                        line={line}
                        locale={locale}
                        ui={lineRatingUi}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="app-card mt-6 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {ui.paymentTitle}
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">{ui.paymentMethodLabel}</dt>
            <dd className="font-medium">{paymentMethodText(ui, order.paymentMethodDisplay)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">{ui.paymentStatusLabel}</dt>
            <dd className="font-medium">{paymentStatusText(ui, order.paymentStatus)}</dd>
          </div>
          {order.walletAppliedAmount !== "0" && order.walletAppliedAmount !== "0.00" ? (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">{ui.walletAppliedLabel}</dt>
                <dd className="font-medium">
                  -{formatMoney(order.walletAppliedAmount, order.currency, locale)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">{ui.remainingDueLabel}</dt>
                <dd className="font-medium">
                  {formatMoney(order.remainingAmount, order.currency, locale)}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      <section className="app-card mt-6 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {ui.summary}
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4 tabular-nums">
            <dt className="text-[var(--muted)]">{ui.subtotal}</dt>
            <dd>
              {formatMoney(order.subtotal, order.currency, locale)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 tabular-nums">
            <dt className="text-[var(--muted)]">{ui.shippingFee}</dt>
            <dd>
              {formatMoney(order.shippingFee, order.currency, locale)}
            </dd>
          </div>
          <div
            className={`flex justify-between gap-4 tabular-nums ${
              order.discountTotal !== "0" && order.discountTotal !== "0.00"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-[var(--muted)]"
            }`}
          >
            <dt>{ui.discount}</dt>
            <dd>
              −{formatMoney(order.discountTotal, order.currency, locale)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 tabular-nums">
            <dt className="text-[var(--muted)]">{ui.vat}</dt>
            <dd>
              {formatMoney(order.vatTotal, order.currency, locale)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-3 text-base font-semibold tabular-nums">
            <dt>{ui.grandTotal}</dt>
            <dd>
              {formatMoney(order.totalAmount, order.currency, locale)}
            </dd>
          </div>
        </dl>
      </section>

      <OrderInvoiceTiles
        orderId={order.id}
        invoiceEligible={order.invoiceEligible}
        finalInvoiceAllowed={order.finalInvoiceAllowed}
        locale={locale}
        ui={invoiceUi}
      />
    </PageShell>
  );
}
