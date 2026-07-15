"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";
type StepId = "branding" | "shipping" | "payout";
type ShippingMode = "DIRECT" | "INDIRECT";
type IndirectFulfillment = "FORSEIZ_STOCK" | "ON_ORDER";

type Setup = {
  completedCount: number;
  totalSteps: number;
  steps: { id: StepId; complete: boolean }[];
  branding: { logoUrl: string | null; bannerUrl: string | null };
  shipping: {
    shippingNotes: string | null;
    shippingMode: ShippingMode;
    indirectFulfillment: IndirectFulfillment | null;
    shippingFee: string | null;
    profileStatus: "PENDING_APPROVAL" | "APPROVED";
    feeSetByAdmin: boolean;
    pendingRequest: boolean;
  };
  payout: { payoutAccountHolder: string | null; payoutIbanMasked: string | null };
};

type Ui = Record<string, string>;

export default function VendorSetupForm({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<StepId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [shippingNotes, setShippingNotes] = useState("");
  const [shippingMode, setShippingMode] = useState<ShippingMode>("DIRECT");
  const [indirectFulfillment, setIndirectFulfillment] = useState<IndirectFulfillment | "">("");
  const [shippingFee, setShippingFee] = useState("15");
  const [payoutAccountHolder, setPayoutAccountHolder] = useState("");
  const [payoutIban, setPayoutIban] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/vendor/setup", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { setup: Setup };
      setSetup(data.setup);
      setLogoUrl(data.setup.branding.logoUrl ?? "");
      setBannerUrl(data.setup.branding.bannerUrl ?? "");
      setShippingNotes(data.setup.shipping.shippingNotes ?? "");
      setShippingMode(data.setup.shipping.shippingMode ?? "DIRECT");
      setIndirectFulfillment(data.setup.shipping.indirectFulfillment ?? "");
      setShippingFee(data.setup.shipping.shippingFee ?? "15");
      setPayoutAccountHolder(data.setup.payout.payoutAccountHolder ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveStep(step: StepId, body: Record<string, unknown>) {
    setSaving(step);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/vendor/setup/${step}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.saveError);
      }
      const data = (await res.json()) as { setup: Setup };
      setSetup(data.setup);
      setMessage(ui.saved);
      toast.success(toastDict.setupStepSaved);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.saveError;
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(null);
    }
  }

  function onBranding(e: FormEvent) {
    e.preventDefault();
    void saveStep("branding", { logoUrl, bannerUrl });
  }

  function onShipping(e: FormEvent) {
    e.preventDefault();
    void saveStep("shipping", {
      shippingNotes,
      shippingMode,
      indirectFulfillment: shippingMode === "INDIRECT" ? indirectFulfillment || null : null,
      shippingFee: Number.parseFloat(shippingFee),
    });
  }

  function onPayout(e: FormEvent) {
    e.preventDefault();
    void saveStep("payout", { payoutAccountHolder, payoutIban });
  }

  if (loading) return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading ?? "…"}</p>;
  if (error && !setup) return <p className="mt-8 text-sm text-red-600">{error}</p>;
  if (!setup) return null;

  const stepDone = (id: StepId) => setup.steps.find((s) => s.id === id)?.complete ?? false;

  return (
    <div className="mt-8 space-y-8" dir={direction}>
      <p className="text-sm text-[var(--muted)]">
        {ui.progress.replace("{done}", String(setup.completedCount)).replace("{total}", String(setup.totalSteps))}
      </p>
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold">
          {ui.stepBranding} {stepDone("branding") ? `✓` : ""}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{ui.stepBrandingHint}</p>
        <form className="mt-4 space-y-3" onSubmit={onBranding}>
          <label className="block text-sm">
            {ui.logoUrl}
            <input className="mt-1 w-full rounded border px-3 py-2 dark:bg-[var(--surface)]" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </label>
          <label className="block text-sm">
            {ui.bannerUrl}
            <input className="mt-1 w-full rounded border px-3 py-2 dark:bg-[var(--surface)]" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} />
          </label>
          <button type="submit" disabled={saving === "branding"} className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60">
            {saving === "branding" ? ui.saving : ui.save}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold">
          {ui.stepShipping} {stepDone("shipping") ? `✓` : ""}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{ui.stepShippingHint}</p>
        {setup.shipping.profileStatus === "APPROVED" ? (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{ui.shippingStatusApproved}</p>
        ) : (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{ui.shippingStatusPending}</p>
        )}
        {setup.shipping.feeSetByAdmin ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{ui.shippingSetByAdmin}</p>
        ) : null}
        {setup.shipping.pendingRequest ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{ui.shippingStatusPendingRequest}</p>
        ) : null}
        <form className="mt-4 space-y-3" onSubmit={onShipping}>
          <label className="block text-sm">
            {ui.shippingMode}
            <select
              className="app-input mt-1 w-full"
              value={shippingMode}
              onChange={(e) => setShippingMode(e.target.value as ShippingMode)}
            >
              <option value="DIRECT">{ui.shippingModeDirect}</option>
              <option value="INDIRECT">{ui.shippingModeIndirect}</option>
            </select>
          </label>
          {shippingMode === "INDIRECT" ? (
            <label className="block text-sm">
              {ui.indirectFulfillment}
              <select
                className="app-input mt-1 w-full"
                value={indirectFulfillment}
                onChange={(e) => setIndirectFulfillment(e.target.value as IndirectFulfillment)}
                required
              >
                <option value="">{ui.indirectFulfillment}</option>
                <option value="FORSEIZ_STOCK">{ui.indirectForseizStock}</option>
                <option value="ON_ORDER">{ui.indirectOnOrder}</option>
              </select>
            </label>
          ) : null}
          <label className="block text-sm">
            {ui.shippingFee}
            <input
              className="mt-1 w-full rounded border px-3 py-2 dark:bg-[var(--surface)]"
              type="number"
              min={0}
              step="0.01"
              value={shippingFee}
              onChange={(e) => setShippingFee(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            {ui.shippingNotes}
            <textarea
              className="app-input mt-1 min-h-28 w-full resize-y"
              dir="auto"
              rows={4}
              value={shippingNotes}
              onChange={(e) => setShippingNotes(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={saving === "shipping" || setup.shipping.pendingRequest} className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60">
            {saving === "shipping" ? ui.saving : ui.submitShippingRequest}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold">
          {ui.stepPayout} {stepDone("payout") ? `✓` : ""}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{ui.stepPayoutHint}</p>
        {setup.payout.payoutIbanMasked ? (
          <p className="mt-2 text-xs text-[var(--muted)]">IBAN: {setup.payout.payoutIbanMasked}</p>
        ) : null}
        <form className="mt-4 space-y-3" onSubmit={onPayout}>
          <label className="block text-sm">
            {ui.payoutAccountHolder}
            <input className="mt-1 w-full rounded border px-3 py-2 dark:bg-[var(--surface)]" value={payoutAccountHolder} onChange={(e) => setPayoutAccountHolder(e.target.value)} required />
          </label>
          <label className="block text-sm">
            {ui.payoutIban}
            <input className="mt-1 w-full rounded border px-3 py-2 dark:bg-[var(--surface)]" value={payoutIban} onChange={(e) => setPayoutIban(e.target.value)} required />
          </label>
          <button type="submit" disabled={saving === "payout"} className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60">
            {saving === "payout" ? ui.saving : ui.save}
          </button>
        </form>
      </section>

      <Link href="/vendor" className="text-sm text-link">
        {ui.backToDashboard}
      </Link>
    </div>
  );
}
