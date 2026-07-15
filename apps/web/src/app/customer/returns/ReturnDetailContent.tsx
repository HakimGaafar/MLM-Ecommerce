import Link from "next/link";
import { buildReturnRefundTimeline, type CustomerReturnDetailDto } from "@mlm/domain";
import ReturnRefundTimeline from "@/components/returns/ReturnRefundTimeline";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { formatMoney } from "@/lib/format-currency";
import CancelReturnButton from "./CancelReturnButton";

type Locale = "en" | "ar";

type Ui = {
  detailTitle: string;
  backToList: string;
  viewOrder: string;
  status: string;
  reason: string;
  details: string;
  policyAccepted: string;
  orderTotal: string;
  currency: string;
  cancel: string;
  cancelling: string;
  cancelError: string;
  cancelled: string;
  rejectionReason: string;
  returnUnitsTitle: string;
  refundTimelineTitle: string;
  refundRejectedMessage: string;
  refundCancelledMessage: string;
  refundTimelineSteps: Record<
    "SUBMITTED" | "RECEIVED" | "INSPECTION" | "REFUND" | "COMPLETED",
    { title: string; description: string }
  >;
};

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale === "ar" ? "ar-SA" : "en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: string): string {
  if (status === "REFUND_COMPLETED") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "PROCESSING_REJECTED" || status === "CANCELLED_BY_CUSTOMER") {
    return "bg-red-500/15 text-red-700 dark:text-red-300";
  }
  return "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--foreground)]";
}

export default function ReturnDetailContent({
  ret,
  locale,
  ui,
  reasonLabels,
  statusLabels,
}: {
  ret: CustomerReturnDetailDto;
  locale: Locale;
  ui: Ui;
  reasonLabels: Record<string, string>;
  statusLabels: Record<string, string>;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const timeline = buildReturnRefundTimeline(ret.status);
  const statusLabel = statusLabels[ret.status] ?? ret.status;

  return (
    <PageShell dir={direction} maxWidth="3xl">
      <PageHeader
        title={ui.detailTitle}
        subtitle={ret.orderNo}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/returns" className="text-link text-sm font-medium">
              {ui.backToList}
            </Link>
            <Link href={`/orders/${ret.orderId}`} className="text-link text-sm font-medium">
              {ui.viewOrder}
            </Link>
          </div>
        }
      />

      <ReturnRefundTimeline
        timeline={timeline}
        locale={locale}
        title={ui.refundTimelineTitle}
        stepLabels={ui.refundTimelineSteps}
        rejectedMessage={ui.refundRejectedMessage}
        cancelledMessage={ui.refundCancelledMessage}
      />

      <section className="app-card mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {ui.status}
          </h2>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(ret.status)}`}
          >
            {statusLabel}
          </span>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          {ret.status === "PROCESSING_REJECTED" && ret.rejectionReason ? (
            <div>
              <dt className="text-[var(--muted)]">{ui.rejectionReason}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">
                {ret.rejectionReason}
              </dd>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--muted)]">{ui.reason}</dt>
            <dd className="font-medium">{reasonLabels[ret.reason] ?? ret.reason}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.details}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">{ret.details}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--muted)]">{ui.policyAccepted}</dt>
            <dd className="font-medium">{formatDate(ret.policyAcceptedAt, locale)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--border)] pt-3">
            <dt className="font-medium text-[var(--foreground)]">{ui.orderTotal}</dt>
            <dd className="font-semibold tabular-nums">
              {formatMoney(ret.orderTotalAmount, "SAR", locale)}
            </dd>
          </div>
        </dl>
      </section>

      {ret.units.length > 0 ? (
        <section className="app-card mt-6 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {ui.returnUnitsTitle}
          </h2>
          <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
            {ret.units.map((unit) => (
              <li
                key={unit.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <span>
                  <span className="font-medium text-[var(--foreground)]">{unit.productName}</span>
                  {unit.unitLabel ? (
                    <span className="mt-0.5 block font-mono text-xs text-[var(--muted)]">
                      {unit.unitLabel}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums font-semibold">
                  {formatMoney(unit.lineTotal, "SAR", locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CancelReturnButton
        returnId={ret.id}
        status={ret.status}
        locale={locale}
        labels={{
          cancel: ui.cancel,
          cancelling: ui.cancelling,
          cancelError: ui.cancelError,
          cancelled: ui.cancelled,
        }}
      />
    </PageShell>
  );
}
