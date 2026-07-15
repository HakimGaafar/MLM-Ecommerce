"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { fulfillmentTypeLabel } from "@/lib/fulfillment-labels";
import { downloadInvoicePdf } from "@/lib/invoices/download-invoice-pdf";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type LineRating = {
  productStars: number;
  vendorStars: number;
  deliveryStars: number;
  comment?: string;
  ratedAt: string;
};

type FulfillmentGroup = {
  vendorId: string;
  vendorName: string;
  fulfillmentType: string;
  fulfillmentStatus: string;
  fulfillmentUpdatedAt: string;
  lineCount: number;
  canVendorUpdate: boolean;
  canAdminUpdate: boolean;
};

type Line = {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitIndex: number | null;
  unitLabel: string | null;
  unitStatus: string;
  unitPrice: string;
  lineTotal: string;
  fulfillmentType: string;
  vendorFulfillmentStatus: string;
  vendorFulfillmentUpdatedAt: string;
  rating: LineRating | null;
};

type Shipping = {
  recipientName: string;
  phone: string;
  countryCode: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
} | null;

type OrderDetail = {
  orderId: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentMethodDisplay: string;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  shipping: Shipping;
  lines: Line[];
  fulfillmentGroups: FulfillmentGroup[];
  canUpdateStatus: boolean;
  canUpdateLineStatus: boolean;
  canUpdateFulfillmentGroups: boolean;
  canUpdatePaymentStatus: boolean;
  isMultiVendorOrder: boolean;
  vendorSubtotal: string;
  currency: string;
  commissionInvoiceEligible: boolean;
  commissionInvoiceAvailable: boolean;
  fulfillmentEscalations: {
    id: string;
    level: string;
    fulfillmentType: string | null;
    message: string | null;
    createdAt: string;
  }[];
  vendorRemoval: { reason: string; createdAt: string } | null;
  fulfillmentView: "buttons" | "split" | "platform-handled" | "multi-vendor-group";
};

type Ui = {
  loading: string;
  loadError: string;
  back: string;
  orderNo: string;
  status: string;
  buyer: string;
  subtotal: string;
  shippingTitle: string;
  linesTitle: string;
  lineProduct: string;
  unitLabel: string;
  unitStatus: string;
  qty: string;
  unit: string;
  lineTotal: string;
  lineRating: string;
  lineFulfillment: string;
  viewReview: string;
  ratingProduct: string;
  ratingVendor: string;
  ratingDelivery: string;
  statusReadOnly: string;
  multiVendorHint: string;
  fulfillmentGroupsTitle: string;
  fulfillmentGroupsHint: string;
  fulfillmentTypeColumn: string;
  fulfillmentGroupLines: string;
  warehouseAReadOnly: string;
  platformHandledHint: string;
  escalationReminder: string;
  escalationWarning: string;
  escalationEscalation: string;
  removedBannerTitle: string;
  removedBannerReason: string;
  updateFulfillmentGroup: string;
  fulfillmentGroupStatusHint: string;
  updateStatus: string;
  updateLineStatus: string;
  lineStatusHint: string;
  updating: string;
  paymentStatus: string;
  paymentMethod: string;
  updatePaymentStatus: string;
  paymentStatusHint: string;
  paymentNoPermission: string;
  noItems: string;
  singleVendorLinesHint: string;
  commissionInvoiceTitle: string;
  downloadCommissionInvoice: string;
  commissionInvoiceHint: string;
  commissionInvoiceGateClosed: string;
  commissionInvoiceOrderNotEligible: string;
  commissionDownloadError: string;
  downloadingCommission: string;
  paymentLabels: Record<string, string>;
  unitStatusLabels: Record<string, string>;
  paymentMethodLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  nextActionLabels: Record<string, string>;
};

const PAYMENT_STATUSES = ["PENDING", "PAID"] as const;

function allowedNextStatuses(current: string): string[] {
  switch (current) {
    case "NEW":
      return ["PROCESSING", "CANCELLED"];
    case "PROCESSING":
      return ["SHIPPED", "CANCELLED"];
    default:
      return [];
  }
}

function allowedNextLineStatuses(current: string): string[] {
  switch (current) {
    case "NEW":
      return ["PROCESSING", "CANCELLED"];
    case "PROCESSING":
      return ["SHIPPED", "CANCELLED"];
    default:
      return [];
  }
}

function groupSelectableStatuses(current: string): string[] {
  return [current, ...allowedNextLineStatuses(current).filter((s) => s !== current)];
}

export default function VendorOrderDetail({ locale, orderId, ui }: { locale: Locale; orderId: string; ui: Ui }) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<string>("PENDING");
  const [paymentUpdating, setPaymentUpdating] = useState(false);
  const [groupDraftByType, setGroupDraftByType] = useState<Record<string, string>>({});
  const [groupUpdatingType, setGroupUpdatingType] = useState<string | null>(null);
  const [commissionDownloading, setCommissionDownloading] = useState(false);
  const fulfillmentDict = useMemo(
    () => (locale === "ar" ? ar.customerOrderDetail : en.customerOrderDetail),
    [locale],
  );

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/vendor/orders/${orderId}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { order: OrderDetail };
      setOrder(data.order);
      setPaymentDraft(data.order.paymentStatus);
      setGroupDraftByType(
        Object.fromEntries(
          data.order.fulfillmentGroups.map((group) => [group.fulfillmentType, group.fulfillmentStatus]),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [orderId, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchOrder(body: {
    status?: string;
    paymentStatus?: string;
    fulfillmentType?: string;
    fulfillmentStatus?: string;
  }) {
    const res = await fetch(`/api/v1/vendor/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      throw new Error(payload?.error ?? ui.loadError);
    }
    await load();
  }

  async function patchStatus(next: string) {
    setActionError(null);
    setUpdating(true);
    try {
      await patchOrder({ status: next });
      toast.success(toastDict.orderUpdated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  }

  async function patchPaymentStatus() {
    if (!order || paymentDraft === order.paymentStatus) return;
    setActionError(null);
    setPaymentUpdating(true);
    try {
      await patchOrder({ paymentStatus: paymentDraft });
      toast.success(toastDict.orderUpdated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setPaymentUpdating(false);
    }
  }

  async function patchFulfillmentGroup(fulfillmentType: string) {
    if (!order) return;
    const draft = groupDraftByType[fulfillmentType];
    const current = order.fulfillmentGroups.find((g) => g.fulfillmentType === fulfillmentType)
      ?.fulfillmentStatus;
    if (!draft || !current || draft === current) return;
    setActionError(null);
    setGroupUpdatingType(fulfillmentType);
    try {
      await patchOrder({ fulfillmentType, fulfillmentStatus: draft });
      toast.success(toastDict.orderUpdated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setGroupUpdatingType(null);
    }
  }

  function statusLabel(s: string) {
    return ui.statusLabels[s] ?? s;
  }

  function nextLabel(s: string) {
    return ui.nextActionLabels[s] ?? s;
  }

  if (loading && !order) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error || !order) {
    return (
      <div className="space-y-4" dir={direction}>
        <p className="app-alert-error">
          {error ?? ui.loadError}
        </p>
        <Link href="/vendor/orders" className="text-sm text-link font-medium">
          {ui.back}
        </Link>
      </div>
    );
  }

  const nextStatuses = order.canUpdateStatus ? allowedNextStatuses(order.status) : [];

  return (
    <div className="space-y-6" dir={direction}>
      {actionError ? (
        <p className="app-alert-error">{actionError}</p>
      ) : null}
      <Link href="/vendor/orders" className="text-sm text-link font-medium">
        {ui.back}
      </Link>

      {order.vendorRemoval ? (
        <div className="rounded-xl border border-red-500/70 bg-red-500/15 px-4 py-3 text-red-100">
          <p className="text-base font-extrabold">{ui.removedBannerTitle}</p>
          <p className="mt-1 text-sm font-semibold">
            {ui.removedBannerReason} {order.vendorRemoval.reason}
          </p>
        </div>
      ) : null}

      {order.fulfillmentEscalations.length > 0 ? (
        <ul className="space-y-2">
          {order.fulfillmentEscalations.map((esc) => {
            const text =
              esc.message ??
              (esc.level === "WARNING"
                ? ui.escalationWarning
                : esc.level === "ESCALATION"
                  ? ui.escalationEscalation
                  : ui.escalationReminder);
            const className =
              esc.level === "ESCALATION"
                ? "rounded-xl border border-red-500/60 bg-red-500/15 px-4 py-3 text-base font-bold text-red-100"
                : esc.level === "WARNING"
                  ? "app-callout-warning rounded-xl px-4 py-3 text-base font-bold"
                  : "rounded-xl border border-emerald-500/50 bg-emerald-500/18 px-4 py-3 text-base font-bold text-emerald-100";
            return (
              <li key={esc.id} className={className}>
                {text}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="rounded-xl border border-[var(--border)] p-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">{ui.orderNo}</dt>
            <dd className="font-mono font-medium">{order.orderNo}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.status}</dt>
            <dd>{statusLabel(order.status)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.paymentMethod}</dt>
            <dd>{ui.paymentMethodLabels[order.paymentMethodDisplay] ?? order.paymentMethodDisplay}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.paymentStatus}</dt>
            <dd>{ui.paymentLabels[order.paymentStatus] ?? order.paymentStatus}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--muted)]">{ui.buyer}</dt>
            <dd>
              <span className="font-medium">{order.buyerName}</span>
              <span className="mt-0.5 block text-[var(--muted)]">{order.buyerEmail}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.subtotal}</dt>
            <dd className="tabular-nums font-medium">
              {formatMoney(order.vendorSubtotal, order.currency, locale)}
            </dd>
          </div>
        </dl>
      </div>

      <section className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {ui.commissionInvoiceTitle}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {!order.commissionInvoiceEligible
            ? ui.commissionInvoiceOrderNotEligible
            : order.commissionInvoiceAvailable
              ? ui.commissionInvoiceHint
              : ui.commissionInvoiceGateClosed}
        </p>
        <button
          type="button"
          className="btn-secondary btn-press mt-4 inline-flex disabled:opacity-50"
          disabled={!order.commissionInvoiceAvailable || commissionDownloading}
          onClick={() => {
            void (async () => {
              setCommissionDownloading(true);
              try {
                await downloadInvoicePdf(`/api/v1/vendor/orders/${orderId}/commission-invoice`);
              } catch (e) {
                const msg = e instanceof Error ? e.message : ui.commissionDownloadError;
                setActionError(msg);
                toast.error(msg);
              } finally {
                setCommissionDownloading(false);
              }
            })();
          }}
        >
          {commissionDownloading ? ui.downloadingCommission : ui.downloadCommissionInvoice}
        </button>
      </section>

      {!order.canUpdateStatus && order.isMultiVendorOrder ? (
        <p className="app-callout-warning px-3 py-2 text-sm">{ui.multiVendorHint}</p>
      ) : null}

      {order.fulfillmentView === "platform-handled" ? (
        <p className="app-callout-info px-3 py-2 text-sm">{ui.platformHandledHint}</p>
      ) : null}

      {order.fulfillmentGroups.length > 0 &&
      (order.fulfillmentView === "split" || order.fulfillmentView === "multi-vendor-group") ? (
        <section className="rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {ui.fulfillmentGroupsTitle}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {order.canUpdateFulfillmentGroups && order.fulfillmentGroups.length > 1
              ? ui.fulfillmentGroupsHint
              : ui.fulfillmentGroupStatusHint}
          </p>
          <ul className="mt-4 space-y-3">
            {order.fulfillmentGroups.map((group) => (
              <li
                key={group.fulfillmentType}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {fulfillmentTypeLabel(group.fulfillmentType, fulfillmentDict)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {ui.fulfillmentGroupLines.replace("{count}", String(group.lineCount))} ·{" "}
                    {statusLabel(group.fulfillmentStatus)}
                  </p>
                </div>
                {group.canVendorUpdate && order.canUpdateFulfillmentGroups ? (
                  <div className="flex min-w-44 items-end gap-2">
                    <select
                      value={groupDraftByType[group.fulfillmentType] ?? group.fulfillmentStatus}
                      disabled={groupUpdatingType === group.fulfillmentType}
                      onChange={(e) =>
                        setGroupDraftByType((prev) => ({
                          ...prev,
                          [group.fulfillmentType]: e.target.value,
                        }))
                      }
                      className="app-input block min-w-32 text-xs"
                    >
                      {groupSelectableStatuses(group.fulfillmentStatus).map((s) => (
                        <option key={s} value={s}>
                          {ui.statusLabels[s] ?? s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={
                        groupUpdatingType === group.fulfillmentType ||
                        !allowedNextLineStatuses(group.fulfillmentStatus).includes(
                          groupDraftByType[group.fulfillmentType] ?? group.fulfillmentStatus,
                        )
                      }
                      onClick={() => void patchFulfillmentGroup(group.fulfillmentType)}
                      className="btn-neutral rounded-lg px-2 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      {groupUpdatingType === group.fulfillmentType
                        ? ui.updating
                        : ui.updateFulfillmentGroup}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">{ui.warehouseAReadOnly}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {order.canUpdateStatus && nextStatuses.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((s) => (
            <button
              key={s}
              type="button"
              disabled={updating}
              onClick={() => void patchStatus(s)}
              className="btn-neutral rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {updating ? ui.updating : nextLabel(s)}
            </button>
          ))}
        </div>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.paymentStatus}</h2>
        {order.canUpdatePaymentStatus ? (
          <>
            <p className="mt-1 text-xs text-[var(--muted)]">{ui.paymentStatusHint}</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block text-sm">
                <span className="text-[var(--muted)]">{ui.paymentStatus}</span>
                <select
                  className="app-input mt-1 block min-w-[10rem]"
                  value={paymentDraft}
                  disabled={paymentUpdating || updating}
                  onChange={(e) => setPaymentDraft(e.target.value)}
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ui.paymentLabels[s] ?? s}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={paymentUpdating || updating || paymentDraft === order.paymentStatus}
                onClick={() => void patchPaymentStatus()}
                className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--table-head-bg)] disabled:opacity-60"
              >
                {paymentUpdating ? ui.updating : ui.updatePaymentStatus}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.paymentNoPermission}</p>
        )}
      </section>

      {order.shipping ? (
        <section>
          <h2 className="text-lg font-semibold">{ui.shippingTitle}</h2>
          <address className="mt-2 not-italic text-sm leading-relaxed text-[var(--foreground)]">
            {order.shipping.recipientName}
            <br />
            {order.shipping.addressLine1}
            {order.shipping.addressLine2 ? (
              <>
                <br />
                {order.shipping.addressLine2}
              </>
            ) : null}
            <br />
            {order.shipping.city}, {order.shipping.postalCode}
            <br />
            {order.shipping.countryCode} · {order.shipping.phone}
          </address>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">{ui.linesTitle}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{ui.fulfillmentGroupStatusHint}</p>
        {order.lines.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{ui.noItems}</p>
        ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[32rem] text-start text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-2 font-medium">{ui.lineProduct}</th>
                <th className="px-4 py-2 font-medium">{ui.unitLabel}</th>
                <th className="px-4 py-2 font-medium">{ui.qty}</th>
                <th className="px-4 py-2 font-medium">{ui.unit}</th>
                <th className="px-4 py-2 font-medium">{ui.lineTotal}</th>
                <th className="px-4 py-2 font-medium">{ui.fulfillmentTypeColumn}</th>
                <th className="px-4 py-2 font-medium">{ui.lineFulfillment}</th>
                <th className="px-4 py-2 font-medium">{ui.unitStatus}</th>
                <th className="px-4 py-2 font-medium">{ui.lineRating}</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((li) => {
                const groupStatus =
                  order.fulfillmentGroups.find((g) => g.fulfillmentType === li.fulfillmentType)
                    ?.fulfillmentStatus ?? li.vendorFulfillmentStatus;
                return (
                <tr key={li.id} className="border-b border-[var(--table-row-border)] align-top">
                  <td className="px-4 py-2">{li.productName}</td>
                  <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">
                    {li.unitLabel ?? "—"}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{li.quantity}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {formatMoney(li.unitPrice, order.currency, locale)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {formatMoney(li.lineTotal, order.currency, locale)}
                  </td>
                  <td className="px-4 py-2 text-sm text-[var(--muted)]">
                    {fulfillmentTypeLabel(li.fulfillmentType, fulfillmentDict)}
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-sm">{ui.statusLabels[groupStatus] ?? groupStatus}</span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {li.unitStatus && li.unitStatus !== "ACTIVE" ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {ui.unitStatusLabels[li.unitStatus] ?? li.unitStatus}
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {li.rating ? (
                      <div className="space-y-1">
                        <p>
                          {ui.ratingProduct}: {li.rating.productStars}/5 · {ui.ratingVendor}:{" "}
                          {li.rating.vendorStars}/5 · {ui.ratingDelivery}:{" "}
                          {li.rating.deliveryStars}/5
                        </p>
                        {li.rating.comment ? (
                          <p className="text-[var(--muted)]">&ldquo;{li.rating.comment}&rdquo;</p>
                        ) : null}
                        <Link
                          href={`/vendor/reviews?orderItemId=${li.id}`}
                          className="font-medium text-[var(--primary)] underline-offset-4 hover:underline"
                        >
                          {ui.viewReview}
                        </Link>
                      </div>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </div>
  );
}
