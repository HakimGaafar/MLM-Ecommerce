import type { CustomerOrderDetailDto } from "@mlm/domain";
import Link from "next/link";
import { formatMoney } from "@/lib/format-currency";
import {
  paymentMethodDisplayText,
  paymentStatusDisplayText,
} from "@/lib/order-payment-display";
import DownloadOrderSummaryButton from "@/app/(portal)/orders/[id]/invoice/DownloadOrderSummaryButton";

type Locale = "en" | "ar";

type SummaryUi = {
  title: string;
  subtitle: string;
  print: string;
  downloading: string;
  downloadError: string;
  backToOrder: string;
  orderNo: string;
  issued: string;
  status: string;
  billTo: string;
  items: string;
  product: string;
  vendor: string;
  qty: string;
  unit: string;
  lineTotal: string;
  subtotal: string;
  shipping: string;
  discount: string;
  vat: string;
  total: string;
  walletApplied: string;
  remainingDue: string;
  walletCovered: string;
  payment: string;
  paymentMethodLabel: string;
  paymentStatusLabel: string;
  thankYou: string;
  paymentCod: string;
  paymentOnlineCard: string;
  paymentWalletCovered: string;
  paymentPending: string;
  paymentPaid: string;
  paymentFailed: string;
  paymentRefunded: string;
};

function formatIssuedDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function OrderSummaryView({
  order,
  locale,
  ui,
  stepLabel,
}: {
  order: CustomerOrderDetailDto;
  locale: Locale;
  ui: SummaryUi;
  stepLabel: string;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Forseiz";
  const paymentMethod = paymentMethodDisplayText(ui, order.paymentMethodDisplay);
  const paymentStatus = paymentStatusDisplayText(ui, order.paymentStatus);

  return (
    <div className="order-summary-page mx-auto w-full max-w-3xl p-6 sm:p-8" dir={direction}>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/orders/${order.id}`}
            className="text-link text-sm font-medium"
          >
            {ui.backToOrder}
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {ui.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <DownloadOrderSummaryButton
          orderId={order.id}
          label={ui.print}
          downloadingLabel={ui.downloading}
          downloadError={ui.downloadError}
        />
      </div>

      <article className="order-summary-document app-card overflow-hidden p-0 print:border-0 print:shadow-none">
        <header className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-[var(--foreground)]">{appName}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {ui.orderNo}: <span className="font-semibold text-[var(--foreground)]">{order.orderNo}</span>
              </p>
              <p className="text-sm text-[var(--muted)]">
                {ui.issued}: {formatIssuedDate(order.createdAt, locale)}
              </p>
            </div>
            <div className="text-end">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.status}</p>
              <span className="mt-1 inline-flex rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)]">
                {stepLabel}
              </span>
            </div>
          </div>
        </header>

        {order.shipping ? (
          <section className="border-b border-[var(--border)] px-6 py-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.billTo}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">
              <span className="font-semibold">{order.shipping.recipientName}</span>
              <br />
              {order.shipping.addressLine1}
              {order.shipping.addressLine2 ? (
                <>
                  <br />
                  {order.shipping.addressLine2}
                </>
              ) : null}
              <br />
              {order.shipping.city}
              {order.shipping.postalCode ? `, ${order.shipping.postalCode}` : ""}
              <br />
              {order.shipping.countryCode}
              <br />
              <span dir="ltr">{order.shipping.phone}</span>
            </p>
          </section>
        ) : null}

        <section className="px-6 py-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.items}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-start text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="py-2 pe-3 font-semibold">{ui.product}</th>
                  <th className="py-2 pe-3 font-semibold">{ui.qty}</th>
                  <th className="py-2 pe-3 font-semibold">{ui.unit}</th>
                  <th className="py-2 font-semibold">{ui.lineTotal}</th>
                </tr>
              </thead>
              <tbody>
                {order.lineItems.map((line) => (
                  <tr key={line.id} className="border-b border-[var(--table-row-border)] last:border-0">
                    <td className="py-3 pe-3">
                      <p className="font-medium text-[var(--foreground)]">{line.productName}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {ui.vendor}: {line.vendorName}
                      </p>
                    </td>
                    <td className="py-3 pe-3 tabular-nums">{line.quantity}</td>
                    <td className="py-3 pe-3 tabular-nums">
                      {formatMoney(line.unitPrice, order.currency, locale)}
                    </td>
                    <td className="py-3 tabular-nums font-medium">
                      {formatMoney(line.lineTotal, order.currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--foreground)_3%,var(--surface))] px-6 py-5">
          <div className="ms-auto max-w-sm space-y-2 text-sm tabular-nums">
            <div className="flex justify-between gap-4">
              <span className="text-[var(--muted)]">{ui.subtotal}</span>
              <span>{formatMoney(order.subtotal, order.currency, locale)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--muted)]">{ui.shipping}</span>
              <span>{formatMoney(order.shippingFee, order.currency, locale)}</span>
            </div>
            <div
              className={`flex justify-between gap-4 ${
                order.discountTotal !== "0" && order.discountTotal !== "0.00"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : ""
              }`}
            >
              <span className="text-[var(--muted)]">{ui.discount}</span>
              <span>−{formatMoney(order.discountTotal, order.currency, locale)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--muted)]">{ui.vat}</span>
              <span>{formatMoney(order.vatTotal, order.currency, locale)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-3 text-base font-semibold">
              <span>{ui.total}</span>
              <span>{formatMoney(order.totalAmount, order.currency, locale)}</span>
            </div>
            {order.walletAppliedAmount !== "0" && order.walletAppliedAmount !== "0.00" ? (
              <>
                <div className="flex justify-between gap-4 text-emerald-700 dark:text-emerald-400">
                  <span>{ui.walletApplied}</span>
                  <span>-{formatMoney(order.walletAppliedAmount, order.currency, locale)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-2 font-semibold">
                  <span>{ui.remainingDue}</span>
                  <span>{formatMoney(order.remainingAmount, order.currency, locale)}</span>
                </div>
              </>
            ) : null}
          </div>

          <dl className="mt-6 grid gap-2 border-t border-[var(--border)] pt-4 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
              <dt className="text-[var(--muted)]">{ui.paymentMethodLabel}</dt>
              <dd className="font-medium">{paymentMethod}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
              <dt className="text-[var(--muted)]">{ui.paymentStatusLabel}</dt>
              <dd className="font-medium">{paymentStatus}</dd>
            </div>
          </dl>

          <p className="mt-6 text-center text-xs text-[var(--muted)]">{ui.thankYou}</p>
        </section>
      </article>
    </div>
  );
}
