"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type DetailPayload = {
  detail: {
    id: string;
    orderId: string;
    status: string;
    reason: string;
    details: string;
    rejectionReason: string | null;
    policyAcceptedAt: string;
    createdAt: string;
    updatedAt: string;
    allowedNextStatuses: string[];
    returnShippingFee?: string;
    returnCostZone?: string;
    returnCostBearer?: string;
    returnCostFinalFee?: string | null;
    returnCostBearerFinal?: string | null;
    returnCostCurrency?: string;
    returnCostNote?: string | null;
    hubInspectionRequired?: boolean;
    hubReceivedAt?: string | null;
    hubInspectedAt?: string | null;
    hubInspectionNote?: string | null;
    goodsDisposition?: string;
    order: { id: string; orderNo: string; totalAmount: string; status: string };
    buyer: { name: string; email: string };
    units: Array<{
      id: string;
      unitIndex: number | null;
      unitLabel: string | null;
      productName: string;
      lineTotal: string;
      unitStatus: string;
    }>;
  };
};

type Ui = {
  loading: string;
  loadError: string;
  back: string;
  openOrder: string;
  orderNo: string;
  orderStatus: string;
  returnStatus: string;
  reason: string;
  details: string;
  policyAccepted: string;
  buyer: string;
  orderTotal: string;
  noTransitions: string;
  applyStatus: string;
  selectNext: string;
  updating: string;
  updateError: string;
  rejectionReason: string;
  rejectionReasonRequired: string;
  rejectionReasonPlaceholder: string;
  returnUnitsTitle: string;
  returnShipping: string;
  hubInspect: string;
  finalReturnFee: string;
  shippingBearer: string;
  bearerCustomer: string;
  bearerVendor: string;
  bearerPlatform: string;
  goodsAfterAccept: string;
  dispositionHoldAtHub: string;
  dispositionReturnToVendor: string;
  dispositionDispose: string;
  hubInspectionNote: string;
  orderStatusLabels: Record<string, string>;
  returnStatusLabels: Record<string, string>;
  reasonLabels: Record<string, string>;
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

export default function AdminReturnDetail({
  returnId,
  locale,
  ui,
}: {
  returnId: string;
  locale: Locale;
  ui: Ui;
}) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DetailPayload["detail"] | null>(null);
  const [selectedNext, setSelectedNext] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [finalFee, setFinalFee] = useState("");
  const [bearerFinal, setBearerFinal] = useState<"CUSTOMER" | "VENDOR" | "PLATFORM" | "">("");
  const [disposition, setDisposition] = useState<"HOLD_AT_HUB" | "RETURN_TO_VENDOR" | "DISPOSE">(
    "HOLD_AT_HUB",
  );
  const [hubNote, setHubNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/returns/${encodeURIComponent(returnId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as DetailPayload;
      setPayload(data.detail);
      const first = data.detail.allowedNextStatuses[0] ?? "";
      setSelectedNext(first);
      setRejectionReason(data.detail.rejectionReason ?? "");
      setFinalFee(data.detail.returnCostFinalFee ?? data.detail.returnShippingFee ?? "");
      setBearerFinal(
        (data.detail.returnCostBearerFinal as typeof bearerFinal) ||
          (data.detail.returnCostBearer as typeof bearerFinal) ||
          "",
      );
      setDisposition(
        (data.detail.goodsDisposition as typeof disposition) || "HOLD_AT_HUB",
      );
      setHubNote(data.detail.hubInspectionNote ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [returnId, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyStatus() {
    if (!selectedNext || !payload) return;
    if (selectedNext === "PROCESSING_REJECTED" && !rejectionReason.trim()) {
      setUpdateError(ui.rejectionReasonRequired);
      return;
    }
    setUpdateError(null);
    setUpdating(true);
    try {
      const feeNum = Number.parseFloat(finalFee);
      const requestBody: Record<string, unknown> = {
        status: selectedNext,
        goodsDisposition: disposition,
        hubInspectionNote: hubNote.trim() || undefined,
      };
      if (selectedNext === "PROCESSING_REJECTED") {
        requestBody.rejectionReason = rejectionReason.trim();
      }
      if (Number.isFinite(feeNum) && feeNum >= 0) {
        requestBody.returnCostFinalFee = feeNum;
      }
      if (bearerFinal) requestBody.returnCostBearerFinal = bearerFinal;
      const res = await fetch(`/api/v1/admin/returns/${encodeURIComponent(returnId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseBody = (await res.json().catch(() => null)) as { error?: string; status?: string } | null;
      if (!res.ok) {
        throw new Error(responseBody?.error ?? ui.updateError);
      }
      toast.success(toastDict.returnUpdated);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.updateError;
      setUpdateError(msg);
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  }

  if (loading && !payload) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error || !payload) {
    return (
      <p className="app-alert-error">
        {error ?? ui.loadError}
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-6" dir={direction}>
      <Link href="/admin/returns" className="text-sm font-medium text-link">
        {ui.back}
      </Link>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 dark:border-[var(--border)] dark:bg-[var(--surface)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-sm text-[var(--muted)]">{payload.id}</p>
          <Link href={`/admin/orders/${payload.order.id}`} className="text-sm font-medium text-link">
            {ui.openOrder}
          </Link>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--muted)]">{ui.orderNo}</dt>
            <dd className="font-medium font-mono">{payload.order.orderNo}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--muted)]">{ui.orderStatus}</dt>
            <dd className="font-medium">
              {ui.orderStatusLabels[payload.order.status] ?? payload.order.status}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--muted)]">{ui.returnStatus}</dt>
            <dd className="font-medium">
              {ui.returnStatusLabels[payload.status] ?? payload.status}
            </dd>
          </div>
          {payload.status === "PROCESSING_REJECTED" && payload.rejectionReason ? (
            <div>
              <dt className="text-[var(--muted)]">{ui.rejectionReason}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">
                {payload.rejectionReason}
              </dd>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--muted)]">{ui.reason}</dt>
            <dd className="font-medium">{ui.reasonLabels[payload.reason] ?? payload.reason}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.details}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-[var(--foreground)]">{payload.details}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--muted)]">{ui.policyAccepted}</dt>
            <dd className="font-medium">{formatDate(payload.policyAcceptedAt, locale)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--muted)]">{ui.buyer}</dt>
            <dd className="font-medium">
              {payload.buyer.name}
              <span className="text-[var(--muted)]"> · {payload.buyer.email}</span>
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--muted)]">{ui.orderTotal}</dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(payload.order.totalAmount, "SAR", locale)}
            </dd>
          </div>
          {payload.returnShippingFee != null ? (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-[var(--muted)]">{ui.returnShipping}</dt>
              <dd className="font-medium tabular-nums">
                {formatMoney(
                  payload.returnCostFinalFee ?? payload.returnShippingFee,
                  payload.returnCostCurrency ?? "SAR",
                  locale,
                )}{" "}
                · {payload.returnCostBearerFinal ?? payload.returnCostBearer} ·{" "}
                {payload.returnCostZone}
                {payload.hubInspectionRequired ? ` · ${ui.hubInspect}` : ""}
              </dd>
            </div>
          ) : null}
          {payload.returnCostNote ? (
            <p className="text-xs text-[var(--muted)]">{payload.returnCostNote}</p>
          ) : null}
        </dl>
      </section>

      {payload.units.length > 0 ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 dark:border-[var(--border)] dark:bg-[var(--surface)]">
          <h2 className="text-sm font-semibold">{ui.returnUnitsTitle}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {payload.units.map((unit) => (
              <li
                key={unit.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--table-row-border)] pb-2 last:border-0 last:pb-0"
              >
                <span>
                  {unit.productName}
                  {unit.unitLabel ? (
                    <span className="mt-0.5 block font-mono text-xs text-[var(--muted)]">
                      {unit.unitLabel}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums font-medium">
                  {formatMoney(unit.lineTotal, "SAR", locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {payload.allowedNextStatuses.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.noTransitions}</p>
      ) : (
        <form
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 dark:border-[var(--border)] dark:bg-[var(--surface)]"
          onSubmit={(e) => {
            e.preventDefault();
            void applyStatus();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{ui.selectNext}</span>
            <select
              className="app-input max-w-xs"
              value={selectedNext}
              onChange={(ev) => setSelectedNext(ev.target.value)}
            >
              {payload.allowedNextStatuses.map((s) => (
                <option key={s} value={s}>
                  {ui.returnStatusLabels[s] ?? s}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 grid max-w-xl gap-3 text-sm sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="font-medium">{ui.finalReturnFee}</span>
              <input
                className="app-input"
                value={finalFee}
                onChange={(ev) => setFinalFee(ev.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium">{ui.shippingBearer}</span>
              <select
                className="app-input"
                value={bearerFinal}
                onChange={(ev) => setBearerFinal(ev.target.value as typeof bearerFinal)}
              >
                <option value="CUSTOMER">{ui.bearerCustomer}</option>
                <option value="VENDOR">{ui.bearerVendor}</option>
                <option value="PLATFORM">{ui.bearerPlatform}</option>
              </select>
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="font-medium">{ui.goodsAfterAccept}</span>
              <select
                className="app-input"
                value={disposition}
                onChange={(ev) => setDisposition(ev.target.value as typeof disposition)}
              >
                <option value="HOLD_AT_HUB">{ui.dispositionHoldAtHub}</option>
                <option value="RETURN_TO_VENDOR">{ui.dispositionReturnToVendor}</option>
                <option value="DISPOSE">{ui.dispositionDispose}</option>
              </select>
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="font-medium">{ui.hubInspectionNote}</span>
              <textarea
                className="app-input min-h-20 w-full"
                value={hubNote}
                onChange={(ev) => setHubNote(ev.target.value)}
                maxLength={2000}
              />
            </label>
          </div>
          {selectedNext === "PROCESSING_REJECTED" ? (
            <label className="mt-4 block space-y-1 text-sm">
              <span className="font-medium">{ui.rejectionReason}</span>
              <textarea
                className="app-input min-h-24 w-full max-w-xl"
                value={rejectionReason}
                onChange={(ev) => setRejectionReason(ev.target.value)}
                placeholder={ui.rejectionReasonPlaceholder}
                maxLength={2000}
                required
              />
            </label>
          ) : null}
          {updateError ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{updateError}</p>
          ) : null}
          <button type="submit" disabled={updating} className="btn-primary btn-press mt-4">
            {updating ? ui.updating : ui.applyStatus}
          </button>
        </form>
      )}
    </div>
  );
}
