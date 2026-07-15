"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { useToast } from "@/components/toast/ToastProvider";
import { downloadInvoicePdf } from "@/lib/invoices/download-invoice-pdf";
import { formatMoney } from "@/lib/format-currency";
import { fulfillmentTypeLabel } from "@/lib/fulfillment-labels";
import { getToastDict } from "@/lib/toast-messages";
import AdminOrderOpsPanel from "./AdminOrderOpsPanel";

type Locale = "en" | "ar";

type Line = {
  id: string;
  vendorId: string;
  vendorName: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitIndex: number | null;
  unitLabel: string | null;
  unitStatus: string;
  unitPrice: string;
  lineTotal: string;
  vendorFulfillmentStatus: string;
  vendorFulfillmentUpdatedAt: string;
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

type OrderDetail = {
  orderId: string;
  orderNo: string;
  date: string;
  status: string;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  shipping: Shipping;
  lines: Line[];
  canUpdateStatus: boolean;
  canMarkCompleted: boolean;
  pendingVendorLines: number;
  isMultiVendorOrder: boolean;
  subtotal: string;
  shippingFee: string;
  discountTotal: string;
  vatTotal: string;
  totalAmount: string;
  currency: string;
  paymentMethod: string;
  paymentMethodDisplay: string;
  paymentStatus: string;
  invoicesAvailable: boolean;
  warehouseFulfillmentGroups: FulfillmentGroup[];
  pendingFulfillmentGroups: number;
  blockingGroups: {
    vendorId: string;
    vendorName: string;
    ownerName: string;
    ownerEmail: string;
    contactPhone: string | null;
    fulfillmentType: string;
    fulfillmentStatus: string;
    hoursWaiting: number;
    isStuck: boolean;
    canVendorUpdate: boolean;
  }[];
  escalations: {
    id: string;
    vendorId: string;
    fulfillmentType: string | null;
    level: "REMINDER" | "WARNING" | "ESCALATION";
    createdByName: string;
    createdAt: string;
  }[];
  adminNotes: { id: string; body: string; createdByName: string; createdAt: string }[];
  customerNotices: { id: string; type: string; body: string; createdAt: string }[];
  orderVendors: { vendorId: string; vendorName: string; hasActiveItems: boolean; cancelled: boolean }[];
  canCancelVendor: boolean;
  slaConfig: { bypass?: boolean; demoStuck?: boolean };
};

type Ui = {
  loading: string;
  loadError: string;
  back: string;
  orderNo: string;
  date: string;
  status: string;
  buyer: string;
  subtotal: string;
  shippingFee: string;
  discount: string;
  vat: string;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
  shippingTitle: string;
  linesTitle: string;
  lineProduct: string;
  lineVendor: string;
  unitLabel: string;
  unitStatus: string;
  lineFulfillment: string;
  lineUpdatedAt: string;
  qty: string;
  unit: string;
  lineTotal: string;
  completeBlockedHint: string;
  vendorProgressHint: string;
  noItems: string;
  statusReadOnly: string;
  updating: string;
  statusLabels: Record<string, string>;
  unitStatusLabels: Record<string, string>;
  nextActionLabels: Record<string, string>;
  paymentMethodLabels: Record<string, string>;
  paymentStatusLabels: Record<string, string>;
  updatePaymentStatus: string;
  paymentStatusHint: string;
  invoicesTitle: string;
  downloadVendorSaleInvoice: string;
  downloadCommissionInvoice: string;
  invoicesHint: string;
  invoicesUnavailable: string;
  invoiceDownloadError: string;
  downloadingInvoice: string;
  warehouseFulfillmentTitle: string;
  warehouseFulfillmentHint: string;
  fulfillmentTypeColumn: string;
  updateFulfillmentGroup: string;
  pendingFulfillmentHint: string;
};

type OpsUi = {
  blockingTitle: string;
  blockingHint: string;
  vendor: string;
  fulfillment: string;
  status: string;
  waiting: string;
  actions: string;
  remind: string;
  warn: string;
  escalate: string;
  reminderLabel: string;
  warningLabel: string;
  escalationLabel: string;
  emailVendor: string;
  copyEmail: string;
  copyPhone: string;
  noPhone: string;
  notesTitle: string;
  notesHint: string;
  notePlaceholder: string;
  saveNote: string;
  notifyCustomerTitle: string;
  notifyCustomerHint: string;
  delayTemplate: string;
  sendNotice: string;
  cancelVendorTitle: string;
  cancelVendorHint: string;
  cancelReason: string;
  cancelConfirm: string;
  cancelVendor: string;
  slaBypassHint: string;
  slaDemoHint: string;
  copied: string;
  statusLabels: Record<string, string>;
};

const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

function allowedNextStatuses(current: string): string[] {
  switch (current) {
    case "NEW":
      return ["PROCESSING", "CANCELLED"];
    case "PROCESSING":
      return ["SHIPPED", "CANCELLED"];
    case "SHIPPED":
      return ["COMPLETED"];
    default:
      return [];
  }
}

function allowedGroupStatuses(current: string): string[] {
  switch (current) {
    case "NEW":
      return ["PROCESSING", "CANCELLED"];
    case "PROCESSING":
      return ["SHIPPED", "CANCELLED"];
    default:
      return [];
  }
}

function warehouseSelectableStatuses(current: string): string[] {
  return [current, ...allowedGroupStatuses(current).filter((s) => s !== current)];
}

function formatDateTime(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function AdminOrderDetail({
  locale,
  orderId,
  ui,
  opsUi,
}: {
  locale: Locale;
  orderId: string;
  ui: Ui;
  opsUi: OpsUi;
}) {
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
  const [invoiceDownloading, setInvoiceDownloading] = useState<string | null>(null);
  const [warehouseDraftKey, setWarehouseDraftKey] = useState<Record<string, string>>({});
  const [warehouseUpdatingKey, setWarehouseUpdatingKey] = useState<string | null>(null);
  const fulfillmentDict = useMemo(
    () => (locale === "ar" ? ar.customerOrderDetail : en.customerOrderDetail),
    [locale],
  );

  async function downloadInvoice(kind: "vendor-sale" | "commission", vendorId: string) {
    const key = `${kind}:${vendorId}`;
    setInvoiceDownloading(key);
    setActionError(null);
    try {
      const path =
        kind === "vendor-sale"
          ? `/api/v1/admin/orders/${orderId}/vendor-sale-invoice/${vendorId}`
          : `/api/v1/admin/orders/${orderId}/commission-invoice/${vendorId}`;
      await downloadInvoicePdf(path);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.invoiceDownloadError;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setInvoiceDownloading(null);
    }
  }

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { order: OrderDetail };
      setOrder(data.order);
      setPaymentDraft(data.order.paymentStatus);
      setWarehouseDraftKey(
        Object.fromEntries(
          data.order.warehouseFulfillmentGroups.map((g) => [
            `${g.vendorId}:${g.fulfillmentType}`,
            g.fulfillmentStatus,
          ]),
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
    vendorId?: string;
    fulfillmentType?: string;
    fulfillmentStatus?: string;
  }) {
    setActionError(null);
    const res = await fetch(`/api/v1/admin/orders/${orderId}`, {
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

  async function patchWarehouseGroup(vendorId: string, fulfillmentType: string) {
    if (!order) return;
    const key = `${vendorId}:${fulfillmentType}`;
    const draft = warehouseDraftKey[key];
    const current = order.warehouseFulfillmentGroups.find(
      (g) => g.vendorId === vendorId && g.fulfillmentType === fulfillmentType,
    )?.fulfillmentStatus;
    if (!draft || !current || draft === current) return;
    setUpdating(true);
    try {
      await patchOrder({ vendorId, fulfillmentType, fulfillmentStatus: draft });
      toast.success(toastDict.orderUpdated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setUpdating(false);
      setWarehouseUpdatingKey(null);
    }
  }

  function statusLabel(s: string) {
    return ui.statusLabels[s] ?? s;
  }

  function nextLabel(s: string) {
    return ui.nextActionLabels[s] ?? s;
  }

  function formatOrderDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
        <Link href="/admin/orders" className="text-sm text-link font-medium">
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
      <Link href="/admin/orders" className="text-sm text-link font-medium">
        {ui.back}
      </Link>
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
            <dt className="text-[var(--muted)]">{ui.date}</dt>
            <dd>{formatOrderDate(order.createdAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--muted)]">{ui.buyer}</dt>
            <dd>
              <span className="font-medium">{order.buyerName}</span>
              <span className="mt-0.5 block text-[var(--muted)]">{order.buyerEmail}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.paymentMethod}</dt>
            <dd>{ui.paymentMethodLabels[order.paymentMethodDisplay] ?? order.paymentMethodDisplay}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.paymentStatus}</dt>
            <dd>{ui.paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.subtotal}</dt>
            <dd className="tabular-nums">
              {formatMoney(order.subtotal, order.currency, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.shippingFee}</dt>
            <dd className="tabular-nums">
              {formatMoney(order.shippingFee, order.currency, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.discount}</dt>
            <dd className="tabular-nums">
              {formatMoney(order.discountTotal, order.currency, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.vat}</dt>
            <dd className="tabular-nums">
              {formatMoney(order.vatTotal, order.currency, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.total}</dt>
            <dd className="tabular-nums font-semibold">
              {formatMoney(order.totalAmount, order.currency, locale)}
            </dd>
          </div>
        </dl>
      </div>

      {nextStatuses.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((s) => (
            <button
              key={s}
              type="button"
              disabled={updating || (s === "COMPLETED" && !order.canMarkCompleted)}
              onClick={() => void patchStatus(s)}
              className="btn-neutral rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {updating ? ui.updating : nextLabel(s)}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">{ui.statusReadOnly}</p>
      )}
      {order.isMultiVendorOrder && order.status === "SHIPPED" && !order.canMarkCompleted ? (
        <p className="app-callout-warning px-3 py-2 text-sm">
          {ui.completeBlockedHint}{" "}
          {ui.pendingFulfillmentHint.replace("{count}", String(order.pendingFulfillmentGroups))}
        </p>
      ) : null}

      {order ? (
        <AdminOrderOpsPanel
          locale={locale}
          orderId={orderId}
          ui={opsUi}
          fulfillmentDict={fulfillmentDict}
          blockingGroups={order.blockingGroups}
          escalations={order.escalations}
          adminNotes={order.adminNotes}
          customerNotices={order.customerNotices}
          orderVendors={order.orderVendors}
          canCancelVendor={order.canCancelVendor}
          slaBypass={Boolean(order.slaConfig?.bypass)}
          slaDemo={Boolean(order.slaConfig?.demoStuck)}
          onReload={load}
        />
      ) : null}

      <section className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">{ui.paymentStatus}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{ui.paymentStatusHint}</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">{ui.paymentStatus}</span>
            <select
              value={paymentDraft}
              disabled={paymentUpdating || updating}
              onChange={(e) => setPaymentDraft(e.target.value)}
              className="app-input min-w-[10rem]"
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ui.paymentStatusLabels[s] ?? s}
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
        {order.lines.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{ui.noItems}</p>
        ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[40rem] text-start text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-2 font-medium">{ui.lineProduct}</th>
                <th className="px-4 py-2 font-medium">{ui.lineVendor}</th>
                <th className="px-4 py-2 font-medium">{ui.unitLabel}</th>
                <th className="px-4 py-2 font-medium">{ui.qty}</th>
                <th className="px-4 py-2 font-medium">{ui.unit}</th>
                <th className="px-4 py-2 font-medium">{ui.lineTotal}</th>
                <th className="px-4 py-2 font-medium">{ui.lineFulfillment}</th>
                <th className="px-4 py-2 font-medium">{ui.unitStatus}</th>
                <th className="px-4 py-2 font-medium">{ui.lineUpdatedAt}</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((li) => (
                <tr key={li.id} className="border-b border-[var(--table-row-border)]">
                  <td className="px-4 py-2">{li.productName}</td>
                  <td className="px-4 py-2 text-[var(--muted)]">{li.vendorName}</td>
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
                  <td className="px-4 py-2">
                    {ui.statusLabels[li.vendorFulfillmentStatus] ?? li.vendorFulfillmentStatus}
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
                  <td className="px-4 py-2 text-[var(--muted)]">
                    {formatDateTime(li.vendorFulfillmentUpdatedAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>

      {order.warehouseFulfillmentGroups.length > 0 ? (
        <section className="rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {ui.warehouseFulfillmentTitle}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.warehouseFulfillmentHint}</p>
          <ul className="mt-4 space-y-3">
            {order.warehouseFulfillmentGroups.map((group) => {
              const key = `${group.vendorId}:${group.fulfillmentType}`;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{group.vendorName}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {fulfillmentTypeLabel(group.fulfillmentType, fulfillmentDict)} ·{" "}
                      {statusLabel(group.fulfillmentStatus)} · {group.lineCount} item(s)
                    </p>
                  </div>
                  <div className="flex min-w-44 items-end gap-2">
                    <select
                      value={warehouseDraftKey[key] ?? group.fulfillmentStatus}
                      disabled={warehouseUpdatingKey === key || updating}
                      onChange={(e) =>
                        setWarehouseDraftKey((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="app-input block min-w-32 text-xs"
                    >
                      {warehouseSelectableStatuses(group.fulfillmentStatus).map((s) => (
                        <option key={s} value={s}>
                          {ui.statusLabels[s] ?? s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={
                        warehouseUpdatingKey === key ||
                        updating ||
                        !allowedGroupStatuses(group.fulfillmentStatus).includes(
                          warehouseDraftKey[key] ?? group.fulfillmentStatus,
                        )
                      }
                      onClick={() => {
                        setWarehouseUpdatingKey(key);
                        void patchWarehouseGroup(group.vendorId, group.fulfillmentType);
                      }}
                      className="btn-neutral rounded-lg px-2 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      {warehouseUpdatingKey === key ? ui.updating : ui.updateFulfillmentGroup}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {order.lines.length > 0 ? (
        <section className="rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            {ui.invoicesTitle}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {order.invoicesAvailable ? ui.invoicesHint : ui.invoicesUnavailable}
          </p>
          <ul className="mt-4 space-y-3">
            {[...new Map(order.lines.map((line) => [line.vendorId, line.vendorName])).entries()].map(
              ([vendorId, vendorName]) => (
                <li
                  key={vendorId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-4 py-3"
                >
                  <span className="font-medium">{vendorName}</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary btn-press text-sm disabled:opacity-50"
                      disabled={!order.invoicesAvailable || invoiceDownloading !== null}
                      onClick={() => void downloadInvoice("vendor-sale", vendorId)}
                    >
                      {invoiceDownloading === `vendor-sale:${vendorId}`
                        ? ui.downloadingInvoice
                        : ui.downloadVendorSaleInvoice}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-press text-sm disabled:opacity-50"
                      disabled={!order.invoicesAvailable || invoiceDownloading !== null}
                      onClick={() => void downloadInvoice("commission", vendorId)}
                    >
                      {invoiceDownloading === `commission:${vendorId}`
                        ? ui.downloadingInvoice
                        : ui.downloadCommissionInvoice}
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
