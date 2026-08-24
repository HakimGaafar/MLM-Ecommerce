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
    deliveryCities: Array<{ id: string; countryCode: string; city: string }>;
    ratesNote: string;
  };
  payout: { payoutAccountHolder: string | null; payoutIbanMasked: string | null };
};

type Ui = Record<string, string>;

const STEP_ORDER: StepId[] = ["branding", "shipping", "payout"];

export default function VendorSetupForm({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<StepId | null>(null);
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [shippingNotes, setShippingNotes] = useState("");
  const [shippingMode, setShippingMode] = useState<ShippingMode>("DIRECT");
  const [indirectFulfillment, setIndirectFulfillment] = useState<IndirectFulfillment | "">("");
  const [shippingFee, setShippingFee] = useState("0");
  const [payoutAccountHolder, setPayoutAccountHolder] = useState("");
  const [payoutIban, setPayoutIban] = useState("");
  const [coverageCountry, setCoverageCountry] = useState("SA");
  const [coverageCity, setCoverageCity] = useState("");
  const [deliveryCities, setDeliveryCities] = useState<Array<{ countryCode: string; city: string }>>([]);

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
      setShippingFee(data.setup.shipping.shippingFee ?? "0");
      setPayoutAccountHolder(data.setup.payout.payoutAccountHolder ?? "");
      setDeliveryCities(
        (data.setup.shipping.deliveryCities ?? []).map((c) => ({
          countryCode: c.countryCode,
          city: c.city,
        })),
      );
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
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.saveError;
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function uploadBrandImage(kind: "logo" | "banner", file: File) {
    setUploading(kind);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/v1/vendor/products/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const payload = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !payload?.url) throw new Error(payload?.error ?? ui.uploadError);
      if (kind === "logo") setLogoUrl(payload.url);
      else setBannerUrl(payload.url);
      toast.success(ui.uploadSuccess);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.uploadError;
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(null);
    }
  }

  async function onBranding(e: FormEvent) {
    e.preventDefault();
    const ok = await saveStep("branding", { logoUrl, bannerUrl });
    if (ok) setStepIndex(1);
  }

  async function onShipping(e: FormEvent) {
    e.preventDefault();
    const ok = await saveStep("shipping", {
      shippingNotes,
      shippingMode,
      indirectFulfillment: shippingMode === "INDIRECT" ? indirectFulfillment || null : null,
      shippingFee: 0,
      deliveryCities: shippingMode === "DIRECT" ? deliveryCities : [],
    });
    if (ok) setStepIndex(2);
  }

  async function onPayout(e: FormEvent) {
    e.preventDefault();
    await saveStep("payout", { payoutAccountHolder, payoutIban });
  }

  if (loading) return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading ?? "…"}</p>;
  if (error && !setup) return <p className="mt-8 text-sm text-red-600">{error}</p>;
  if (!setup) return null;

  const stepDone = (id: StepId) => setup.steps.find((s) => s.id === id)?.complete ?? false;
  const current = STEP_ORDER[stepIndex] ?? "branding";

  return (
    <div className="mt-8 space-y-6" dir={direction}>
      <p className="text-sm text-[var(--muted)]">
        {ui.progress.replace("{done}", String(setup.completedCount)).replace("{total}", String(setup.totalSteps))}
      </p>

      <ol className="flex flex-wrap gap-2 text-sm">
        {STEP_ORDER.map((id, index) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => setStepIndex(index)}
              className={`rounded-lg border px-3 py-1.5 ${
                index === stepIndex
                  ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] font-medium"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {index + 1}.{" "}
              {id === "branding" ? ui.stepBranding : id === "shipping" ? ui.stepShipping : ui.stepPayout}
              {stepDone(id) ? " ✓" : ""}
            </button>
          </li>
        ))}
      </ol>

      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {current === "branding" ? (
        <section className="rounded-xl border border-[var(--border)] p-6">
          <h2 className="font-semibold">
            {ui.stepBranding} {stepDone("branding") ? "✓" : ""}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.stepBrandingHint}</p>
          <form className="mt-4 space-y-4" onSubmit={(e) => void onBranding(e)}>
            <div className="space-y-2">
              <p className="text-sm font-medium">{ui.logoUpload}</p>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-16 w-16 rounded object-cover border border-[var(--border)]" />
              ) : null}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full text-sm"
                disabled={uploading === "logo"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadBrandImage("logo", file);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{ui.bannerUpload}</p>
              {bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerUrl} alt="" className="h-24 w-full max-w-md rounded object-cover border border-[var(--border)]" />
              ) : null}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full text-sm"
                disabled={uploading === "banner"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadBrandImage("banner", file);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving === "branding" || !logoUrl || !bannerUrl}
                className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
              >
                {saving === "branding" ? ui.saving : ui.saveAndNext}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {current === "shipping" ? (
        <section className="rounded-xl border border-[var(--border)] p-6">
          <h2 className="font-semibold">
            {ui.stepShipping} {stepDone("shipping") ? "✓" : ""}
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
          <form className="mt-4 space-y-3" onSubmit={(e) => void onShipping(e)}>
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
            ) : (
              <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm font-medium">{ui.deliveryCitiesTitle}</p>
                <p className="text-xs text-[var(--muted)]">{ui.deliveryCitiesHint}</p>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="app-input"
                    value={coverageCountry}
                    onChange={(e) => setCoverageCountry(e.target.value)}
                  >
                    <option value="SA">SA</option>
                    <option value="OM">OM</option>
                    <option value="EG">EG</option>
                  </select>
                  <input
                    className="app-input min-w-[10rem] flex-1"
                    placeholder={ui.deliveryCityPlaceholder}
                    value={coverageCity}
                    onChange={(e) => setCoverageCity(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-neutral rounded-lg px-3 py-2 text-sm"
                    onClick={() => {
                      const city = coverageCity.trim();
                      if (city.length < 2) return;
                      const key = `${coverageCountry}:${city.toLowerCase()}`;
                      if (deliveryCities.some((c) => `${c.countryCode}:${c.city.toLowerCase()}` === key)) {
                        setCoverageCity("");
                        return;
                      }
                      setDeliveryCities((prev) => [...prev, { countryCode: coverageCountry, city }]);
                      setCoverageCity("");
                    }}
                  >
                    {ui.addCity}
                  </button>
                </div>
                {deliveryCities.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {deliveryCities.map((c) => (
                      <li
                        key={`${c.countryCode}:${c.city}`}
                        className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-1 text-xs"
                      >
                        {c.countryCode} · {c.city}
                        <button
                          type="button"
                          className="text-[var(--muted)]"
                          onClick={() =>
                            setDeliveryCities((prev) =>
                              prev.filter(
                                (x) =>
                                  !(
                                    x.countryCode === c.countryCode &&
                                    x.city.toLowerCase() === c.city.toLowerCase()
                                  ),
                              ),
                            )
                          }
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            <p className="text-xs text-[var(--muted)]">{ui.shippingRatesNote ?? setup.shipping.ratesNote}</p>
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
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-neutral rounded-lg px-4 py-2 text-sm" onClick={() => setStepIndex(0)}>
                {ui.back}
              </button>
              <button
                type="submit"
                disabled={saving === "shipping" || setup.shipping.pendingRequest}
                className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
              >
                {saving === "shipping" ? ui.saving : ui.saveAndNext}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {current === "payout" ? (
        <section className="rounded-xl border border-[var(--border)] p-6">
          <h2 className="font-semibold">
            {ui.stepPayout} {stepDone("payout") ? "✓" : ""}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.stepPayoutHint}</p>
          {setup.payout.payoutIbanMasked ? (
            <p className="mt-2 text-xs text-[var(--muted)]">IBAN: {setup.payout.payoutIbanMasked}</p>
          ) : null}
          <form className="mt-4 space-y-3" onSubmit={(e) => void onPayout(e)}>
            <label className="block text-sm">
              {ui.payoutAccountHolder}
              <input
                className="mt-1 w-full rounded border px-3 py-2 dark:bg-[var(--surface)]"
                value={payoutAccountHolder}
                onChange={(e) => setPayoutAccountHolder(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              {ui.payoutIban}
              <input
                className="mt-1 w-full rounded border px-3 py-2 dark:bg-[var(--surface)]"
                value={payoutIban}
                onChange={(e) => setPayoutIban(e.target.value)}
                required
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-neutral rounded-lg px-4 py-2 text-sm" onClick={() => setStepIndex(1)}>
                {ui.back}
              </button>
              <button
                type="submit"
                disabled={saving === "payout"}
                className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
              >
                {saving === "payout" ? ui.saving : ui.save}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <p className="text-sm text-[var(--muted)]">{ui.wizardNote}</p>

      <Link href="/vendor" className="text-sm text-link">
        {ui.backToDashboard}
      </Link>
    </div>
  );
}
