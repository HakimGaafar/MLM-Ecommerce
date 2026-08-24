"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";

type ShippingState = {
  vendorId: string;
  storeName: string;
  shippingMode: "DIRECT" | "INDIRECT";
  indirectFulfillment: "FORSEIZ_STOCK" | "ON_ORDER" | null;
  shippingFee: string;
  shippingNotes: string | null;
  profileStatus: "PENDING_APPROVAL" | "APPROVED";
  feeSetByAdmin: boolean;
};

type Ui = {
  loading: string;
  loadError: string;
  saveError: string;
  saved: string;
  saving: string;
  save: string;
  store: string;
  shippingMode: string;
  shippingModeDirect: string;
  shippingModeIndirect: string;
  indirectFulfillment: string;
  indirectStock: string;
  indirectOnOrder: string;
  shippingFee: string;
  shippingNotes: string;
  adminNote: string;
  profileStatusApproved: string;
  profileStatusPending: string;
  feeSetByAdmin: string;
};

export default function AdminVendorShippingForm({
  vendorId,
  locale,
  ui,
}: {
  vendorId: string;
  locale: Locale;
  ui: Ui;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ShippingState | null>(null);
  const [shippingMode, setShippingMode] = useState<"DIRECT" | "INDIRECT">("DIRECT");
  const [indirectFulfillment, setIndirectFulfillment] = useState<"FORSEIZ_STOCK" | "ON_ORDER">(
    "FORSEIZ_STOCK",
  );
  const [shippingFee, setShippingFee] = useState("15.00");
  const [shippingNotes, setShippingNotes] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/vendors/${encodeURIComponent(vendorId)}/shipping`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const json = (await res.json()) as { shipping: ShippingState };
      setDetail(json.shipping);
      setShippingMode(json.shipping.shippingMode);
      setIndirectFulfillment(json.shipping.indirectFulfillment ?? "FORSEIZ_STOCK");
      setShippingFee(json.shipping.shippingFee);
      setShippingNotes(json.shipping.shippingNotes ?? "");
    } catch {
      toast.error(ui.loadError);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [toast, ui.loadError, vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/vendors/${encodeURIComponent(vendorId)}/shipping`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingMode,
          indirectFulfillment: shippingMode === "INDIRECT" ? indirectFulfillment : null,
          shippingFee: Number(shippingFee),
          shippingNotes: shippingNotes.trim() || null,
          note: note.trim() || undefined,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string; shipping?: ShippingState } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.saveError);
      if (payload?.shipping) setDetail(payload.shipping);
      toast.success(ui.saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  if (!detail) return null;

  return (
    <div className="mt-8 space-y-6 rounded-xl border border-[var(--border)] p-6" dir={direction}>
      <div className="text-sm">
        <div className="text-[var(--muted)]">{ui.store}</div>
        <div className="font-medium">{detail.storeName}</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-zinc-500/15 px-2 py-0.5">
            {detail.profileStatus === "APPROVED" ? ui.profileStatusApproved : ui.profileStatusPending}
          </span>
          {detail.feeSetByAdmin ? (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-blue-700 dark:text-blue-300">
              {ui.feeSetByAdmin}
            </span>
          ) : null}
        </div>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[var(--muted)]">{ui.shippingMode}</span>
        <select
          className="app-input max-w-md"
          value={shippingMode}
          disabled={saving}
          onChange={(e) => setShippingMode(e.target.value as "DIRECT" | "INDIRECT")}
        >
          <option value="DIRECT">{ui.shippingModeDirect}</option>
          <option value="INDIRECT">{ui.shippingModeIndirect}</option>
        </select>
      </label>

      {shippingMode === "INDIRECT" ? (
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-[var(--muted)]">{ui.indirectFulfillment}</span>
          <select
            className="app-input max-w-md"
            value={indirectFulfillment}
            disabled={saving}
            onChange={(e) => setIndirectFulfillment(e.target.value as "FORSEIZ_STOCK" | "ON_ORDER")}
          >
            <option value="FORSEIZ_STOCK">{ui.indirectStock}</option>
            <option value="ON_ORDER">{ui.indirectOnOrder}</option>
          </select>
        </label>
      ) : null}

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[var(--muted)]">{ui.shippingFee}</span>
        <input
          type="number"
          min={0}
          step={0.01}
          className="app-input max-w-xs"
          value={shippingFee}
          disabled={saving}
          onChange={(e) => setShippingFee(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[var(--muted)]">{ui.shippingNotes}</span>
        <textarea
          rows={3}
          className="app-input"
          value={shippingNotes}
          disabled={saving}
          onChange={(e) => setShippingNotes(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[var(--muted)]">{ui.adminNote}</span>
        <input
          type="text"
          className="app-input"
          value={note}
          disabled={saving}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <button
        type="button"
        disabled={saving}
        onClick={() => void onSave()}
        className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
      >
        {saving ? ui.saving : ui.save}
      </button>
    </div>
  );
}
