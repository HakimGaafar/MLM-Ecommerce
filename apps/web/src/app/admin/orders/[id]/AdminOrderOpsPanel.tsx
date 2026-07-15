"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fulfillmentTypeLabel } from "@/lib/fulfillment-labels";
import { formatRelativeTimeFromNow } from "@/lib/format-relative-time";
import { formatWaitHours } from "@/lib/format-wait-duration";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type BlockingGroup = {
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
};

type OrderVendor = {
  vendorId: string;
  vendorName: string;
  hasActiveItems: boolean;
  cancelled: boolean;
};

type Ui = {
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

type Escalation = {
  id: string;
  vendorId: string;
  fulfillmentType: string | null;
  level: "REMINDER" | "WARNING" | "ESCALATION";
  createdByName: string;
  createdAt: string;
};

type CustomerNotice = {
  id: string;
  type: string;
  body: string;
  createdByName?: string;
  createdAt: string;
};

export default function AdminOrderOpsPanel({
  locale,
  orderId,
  ui,
  fulfillmentDict,
  blockingGroups,
  escalations,
  adminNotes,
  customerNotices,
  orderVendors,
  canCancelVendor,
  slaBypass,
  slaDemo,
  onReload,
}: {
  locale: Locale;
  orderId: string;
  ui: Ui;
  fulfillmentDict: {
    fulfillmentDirect: string;
    fulfillmentWarehouseA: string;
    fulfillmentWarehouseB: string;
  };
  blockingGroups: BlockingGroup[];
  escalations: Escalation[];
  adminNotes: { id: string; body: string; createdByName: string; createdAt: string }[];
  customerNotices: CustomerNotice[];
  orderVendors: OrderVendor[];
  canCancelVendor: boolean;
  slaBypass: boolean;
  slaDemo: boolean;
  onReload: () => Promise<void>;
}) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [noteBody, setNoteBody] = useState("");
  const [noticeBody, setNoticeBody] = useState(ui.delayTemplate);
  const [cancelVendorId, setCancelVendorId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setNoticeBody(ui.delayTemplate);
  }, [ui.delayTemplate]);

  async function postEscalation(
    vendorId: string,
    fulfillmentType: string,
    level: "REMINDER" | "WARNING" | "ESCALATION",
  ) {
    const key = `${level}:${vendorId}:${fulfillmentType}`;
    setBusy(key);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/escalations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, fulfillmentType, level }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? "Failed");
      }
      toast.success(toastDict.orderUpdated);
      await onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : toastDict.genericError);
    } finally {
      setBusy(null);
    }
  }

  async function saveNote() {
    setBusy("note");
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      if (!res.ok) throw new Error("Failed");
      setNoteBody("");
      toast.success(toastDict.orderUpdated);
      await onReload();
    } catch {
      toast.error(toastDict.genericError);
    } finally {
      setBusy(null);
    }
  }

  async function sendCustomerNotice() {
    setBusy("notice");
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/customer-notices`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DELAY", body: noticeBody }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(toastDict.orderUpdated);
      await onReload();
    } catch {
      toast.error(toastDict.genericError);
    } finally {
      setBusy(null);
    }
  }

  async function cancelVendor() {
    if (!cancelVendorId || cancelReason.trim().length < 10) return;
    setBusy("cancel");
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/cancel-vendor`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: cancelVendorId, reason: cancelReason }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? "Failed");
      }
      setCancelReason("");
      setCancelDialogOpen(false);
      toast.success(toastDict.orderUpdated);
      await onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : toastDict.genericError);
    } finally {
      setBusy(null);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success(ui.copied);
  }

  function levelLabel(level: Escalation["level"]): string {
    if (locale === "ar") {
      if (level === "REMINDER") return "تذكير";
      if (level === "WARNING") return "تحذير";
      return "تصعيد";
    }
    return level;
  }

  function sentAlreadyLabel(level: Escalation["level"], iso: string): string {
    if (locale === "ar") {
      const levelText = levelLabel(level);
      return `تم إرسال ${levelText} ${formatRelativeTimeFromNow(iso, locale)}.`;
    }
    if (level === "REMINDER") return `Reminder already sent ${formatRelativeTimeFromNow(iso, locale)}.`;
    if (level === "WARNING") return `Warning already sent ${formatRelativeTimeFromNow(iso, locale)}.`;
    return `Escalation already sent ${formatRelativeTimeFromNow(iso, locale)}.`;
  }

  const cancellableVendors = orderVendors.filter((v) => v.hasActiveItems && !v.cancelled);

  return (
    <div className="space-y-6">
      {slaBypass ? <p className="app-callout-info px-3 py-2 text-sm">{ui.slaBypassHint}</p> : null}
      {slaDemo ? <p className="app-callout-warning px-3 py-2 text-sm">{ui.slaDemoHint}</p> : null}

      {blockingGroups.length > 0 ? (
        <section className="rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.blockingTitle}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.blockingHint}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-start text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]">
                  <th className="py-2 pe-3">{ui.vendor}</th>
                  <th className="py-2 pe-3">{ui.fulfillment}</th>
                  <th className="py-2 pe-3">{ui.status}</th>
                  <th className="py-2 pe-3">{ui.waiting}</th>
                  <th className="py-2">{ui.actions}</th>
                </tr>
              </thead>
              <tbody>
                {blockingGroups.map((g) => (
                  <tr key={`${g.vendorId}:${g.fulfillmentType}`} className="border-b border-[var(--table-row-border)]">
                    {(() => {
                      const history = escalations.filter(
                        (e) => e.vendorId === g.vendorId && e.fulfillmentType === g.fulfillmentType,
                      );
                      const remindCount = history.filter((h) => h.level === "REMINDER").length;
                      const warningCount = history.filter((h) => h.level === "WARNING").length;
                      const escalationCount = history.filter((h) => h.level === "ESCALATION").length;
                      const latest = history[0] ?? null;
                      const latestSameReminder = history.find((h) => h.level === "REMINDER");
                      const latestSameWarning = history.find((h) => h.level === "WARNING");
                      const latestSameEscalation = history.find((h) => h.level === "ESCALATION");
                      return (
                        <>
                    <td className="py-3 pe-3">
                      <p className="font-medium">{g.vendorName}</p>
                      <p className="text-xs text-[var(--muted)]">{g.ownerEmail}</p>
                    </td>
                    <td className="py-3 pe-3">{fulfillmentTypeLabel(g.fulfillmentType, fulfillmentDict)}</td>
                    <td className="py-3 pe-3">
                      {ui.statusLabels[g.fulfillmentStatus] ?? g.fulfillmentStatus}
                      {g.isStuck ? " ⚠️" : ""}
                    </td>
                    <td className="py-3 pe-3 tabular-nums">{formatWaitHours(g.hoursWaiting, locale)}</td>
                    <td className="py-3">
                      <div className="flex flex-nowrap items-center justify-start gap-1 overflow-x-auto pb-1">
                        {g.canVendorUpdate ? (
                          <>
                            <button
                              type="button"
                              className="h-9 whitespace-nowrap rounded-lg border border-emerald-500/60 bg-emerald-500/15 px-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25"
                              disabled={busy !== null}
                              onClick={() => void postEscalation(g.vendorId, g.fulfillmentType, "REMINDER")}
                            >
                              {ui.remind}
                            </button>
                            <button
                              type="button"
                              className="h-9 whitespace-nowrap rounded-lg border border-amber-500/60 bg-amber-500/15 px-3 text-sm font-semibold text-amber-200 hover:bg-amber-500/25"
                              disabled={busy !== null}
                              onClick={() => void postEscalation(g.vendorId, g.fulfillmentType, "WARNING")}
                            >
                              {ui.warn}
                            </button>
                            <button
                              type="button"
                              className="h-9 whitespace-nowrap rounded-lg border border-red-500/60 bg-red-500/15 px-3 text-sm font-semibold text-red-200 hover:bg-red-500/25"
                              disabled={busy !== null}
                              onClick={() => void postEscalation(g.vendorId, g.fulfillmentType, "ESCALATION")}
                            >
                              {ui.escalate}
                            </button>
                          </>
                        ) : null}
                        <a
                          href={`mailto:${g.ownerEmail}?subject=Order%20fulfillment`}
                          className="btn-secondary btn-press inline-flex h-9 whitespace-nowrap rounded-lg px-3 text-sm"
                        >
                          {ui.emailVendor}
                        </a>
                        <button
                          type="button"
                          className="btn-secondary btn-press h-9 whitespace-nowrap rounded-lg px-3 text-sm"
                          onClick={() => copyText(g.ownerEmail)}
                        >
                          {ui.copyEmail}
                        </button>
                        {g.contactPhone ? (
                          <button
                            type="button"
                            className="btn-secondary btn-press h-9 whitespace-nowrap rounded-lg px-3 text-sm"
                            onClick={() => copyText(g.contactPhone!)}
                          >
                            {ui.copyPhone}
                          </button>
                        ) : (
                          <span className="px-1 text-[10px] text-[var(--muted)]">{ui.noPhone}</span>
                        )}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted)]">
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-300">
                          {ui.reminderLabel}: {remindCount}
                        </span>
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-300">
                          {ui.warningLabel}: {warningCount}
                        </span>
                        <span className="rounded-full border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 font-semibold text-red-300">
                          {ui.escalationLabel}: {escalationCount}
                        </span>
                        {latest
                          ? locale === "ar"
                            ? ` · آخر إجراء: ${levelLabel(latest.level)} بواسطة ${latest.createdByName} (${formatRelativeTimeFromNow(latest.createdAt, locale)})`
                            : ` · Last: ${latest.level} by ${latest.createdByName} (${formatRelativeTimeFromNow(latest.createdAt, locale)})`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                        {latestSameReminder ? `${sentAlreadyLabel("REMINDER", latestSameReminder.createdAt)} ` : ""}
                        {latestSameWarning ? `${sentAlreadyLabel("WARNING", latestSameWarning.createdAt)} ` : ""}
                        {latestSameEscalation ? sentAlreadyLabel("ESCALATION", latestSameEscalation.createdAt) : ""}
                      </p>
                    </td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">{ui.notesTitle}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{ui.notesHint}</p>
        <ul className="mt-3 space-y-2">
          {adminNotes.map((n) => (
            <li key={n.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {n.createdByName} · {new Date(n.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
        <textarea
          className="app-input mt-3 w-full p-2"
          rows={3}
          value={noteBody}
          placeholder={ui.notePlaceholder}
          onChange={(e) => setNoteBody(e.target.value)}
        />
        <button
          type="button"
          className="btn-neutral mt-2 rounded-lg px-4 py-2 text-sm"
          disabled={!noteBody.trim() || busy !== null}
          onClick={() => void saveNote()}
        >
          {ui.saveNote}
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">{ui.notifyCustomerTitle}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{ui.notifyCustomerHint}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {customerNotices.length > 0
            ? locale === "ar"
              ? `تم إرسال ${customerNotices.length} إشعار/إشعارات. آخر إرسال ${formatRelativeTimeFromNow(customerNotices[0]!.createdAt, locale)}.`
              : `Already sent ${customerNotices.length} notice(s). Last sent ${formatRelativeTimeFromNow(customerNotices[0]!.createdAt, locale)}.`
            : locale === "ar"
              ? "لم يتم إرسال أي إشعار للعميل بعد."
              : "No customer notice has been sent yet."}
        </p>
        <textarea
          className="app-input mt-3 w-full p-2"
          rows={3}
          value={noticeBody}
          onChange={(e) => setNoticeBody(e.target.value)}
        />
        <button
          type="button"
          className="btn-neutral mt-2 rounded-lg px-4 py-2 text-sm"
          disabled={!noticeBody.trim() || busy !== null}
          onClick={() => void sendCustomerNotice()}
        >
          {ui.sendNotice}
        </button>
      </section>

      {canCancelVendor ? (
        <section className="rounded-xl border border-red-200 p-4 dark:border-red-900">
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">{ui.cancelVendorTitle}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{ui.cancelVendorHint}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.vendor}</span>
              <select
                value={cancelVendorId}
                onChange={(e) => setCancelVendorId(e.target.value)}
                className="app-input"
              >
                <option value="">—</option>
                {cancellableVendors.map((v) => (
                  <option key={v.vendorId} value={v.vendorId}>
                    {v.vendorName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.cancelReason}</span>
              <input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="app-input"
              />
            </label>
            <button
              type="button"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={!cancelVendorId || cancelReason.trim().length < 10 || busy !== null}
              onClick={() => setCancelDialogOpen(true)}
            >
              {ui.cancelVendor}
            </button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={cancelDialogOpen}
        title={ui.cancelVendorTitle}
        message={ui.cancelConfirm}
        confirmLabel={ui.cancelVendor}
        cancelLabel={locale === "ar" ? "إلغاء" : "Cancel"}
        confirming={busy === "cancel"}
        confirmingLabel={locale === "ar" ? "جارٍ الإلغاء..." : "Cancelling..."}
        onCancel={() => setCancelDialogOpen(false)}
        onConfirm={() => void cancelVendor()}
      />
    </div>
  );
}
