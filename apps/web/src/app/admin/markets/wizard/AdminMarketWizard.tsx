"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADD_MARKET_CURRENCY_OPTIONS,
  isPaymentCurrencyGatewaySupported,
} from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";
import WizardAnnexEditor from "./WizardAnnexEditor";
import WizardLegalEditor from "./WizardLegalEditor";
import WizardShippingEditor from "./WizardShippingEditor";

type Locale = "en" | "ar";

type ChecklistItem = { id: string; ok: boolean; detail?: string };

type CountryOption = {
  countryCode: string;
  nameEn: string;
  nameAr: string;
  defaultCurrency: string;
  marketCode: string;
  subdomain: string;
};

type DraftSummary = {
  marketCode: string;
  nameEn: string;
  nameAr: string;
  lifecycleStatus: string;
  subdomain: string;
  updatedAt: string;
};

type WizardState = {
  marketCode: string;
  lifecycleStatus: string;
  isActive: boolean;
  papersComplete: boolean;
  cloneSourceCode: string | null;
  currencyOptions: string[];
  identity: {
    nameEn: string;
    nameAr: string;
    subdomain: string;
    defaultCurrency: string;
    paymentCurrencies: string[];
    geoCountryCodes: string[];
  };
  commercial: {
    platformRate: number;
    platformRateCross: number;
    returnWindowDays: number;
    settlementWindowDays: number;
    codEnabled: boolean;
    vatRate: number;
  } | null;
  gateway: {
    canPublish: boolean;
    uncovered: string[];
    matrix: Array<{ currency: string; supportedBy: string[]; covered: boolean }>;
    warnings: string[];
    configuredGateways: string[];
  };
  routing: {
    subdomain: string;
    geoCountryCodes: string[];
    hostBound: boolean;
    geoBound: boolean;
    hostRoutingConfirmed: boolean;
    hostRoutingConfirmedAt: string | null;
    routingOk: boolean;
    detail: { hostResolvesTo: string | null; geoResolvesTo: Record<string, string | null> };
  };
  checklist: ChecklistItem[];
  canMarkReady: boolean;
  canPublish: boolean;
  blockers: string[];
};

type Ui = {
  title: string;
  subtitle: string;
  backToMarkets: string;
  loading: string;
  loadError: string;
  saveError: string;
  saved: string;
  start: string;
  cloneFromOm: string;
  stepIdentity: string;
  stepAnnex: string;
  stepCommercial: string;
  stepShipping: string;
  stepPayments: string;
  stepLegal: string;
  stepPapers: string;
  stepReview: string;
  saveAnnex: string;
  legalNameEn: string;
  legalNameAr: string;
  cr: string;
  unifiedNumber: string;
  address: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
  shippingHint: string;
  shippingAmount: string;
  shippingActive: string;
  saveRate: string;
  shippingEmpty: string;
  legalHintInline: string;
  savePolicy: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  draft: string;
  published: string;
  selectDoc: string;
  nameEn: string;
  nameAr: string;
  defaultCurrency: string;
  paymentCurrencies: string;
  geoCountries: string;
  saveIdentity: string;
  annexHint: string;
  openAnnex: string;
  openLegal: string;
  platformRate: string;
  platformRateCross: string;
  returnDays: string;
  settlementDays: string;
  vatRate: string;
  codEnabled: string;
  saveCommercial: string;
  gatewayMatrix: string;
  uncovered: string;
  papersComplete: string;
  papersHint: string;
  savePapers: string;
  checklistTitle: string;
  markReady: string;
  publish: string;
  publishing: string;
  publishSuccess: string;
  migrateNote: string;
  status: string;
  selectMarket: string;
  blockers: string;
  covered: string;
  notCovered: string;
  noCountries: string;
  addCurrency: string;
  removeCurrency: string;
  routingTitle: string;
  routingHost: string;
  routingGeo: string;
  routingReady: string;
  routingBlocked: string;
  routingHint: string;
  hostConfirmLabel: string;
  hostConfirmHint: string;
  saveHostConfirm: string;
  verifyDns: string;
  verifyingDns: string;
  dnsPass: string;
  dnsFail: string;
  unsupportedCurrency: string;
  unsupportedCurrencyHint: string;
  resumeDrafts: string;
  resume: string;
  deleteDraft: string;
  deleteDraftConfirm: string;
  deleted: string;
  closeWizard: string;
};

const STEPS = [
  "identity",
  "annex",
  "commercial",
  "shipping",
  "payments",
  "legal",
  "papers",
  "review",
] as const;

export default function AdminMarketWizard({
  locale,
  ui,
}: {
  locale: Locale;
  ui: Ui;
  initialMarketCode?: string;
}) {
  const toast = useToast();
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [marketCode, setMarketCode] = useState("");
  const [state, setState] = useState<WizardState | null>(null);
  const [step, setStep] = useState<(typeof STEPS)[number]>("identity");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("");
  const [paymentCurrencies, setPaymentCurrencies] = useState<string[]>([]);
  const [geoCountries, setGeoCountries] = useState("");
  const [platformRate, setPlatformRate] = useState("5");
  const [platformRateCross, setPlatformRateCross] = useState("10");
  const [returnDays, setReturnDays] = useState("15");
  const [settlementDays, setSettlementDays] = useState("7");
  const [vatRate, setVatRate] = useState("0");
  const [codEnabled, setCodEnabled] = useState(true);
  const [papersComplete, setPapersComplete] = useState(false);
  const [dnsMessage, setDnsMessage] = useState<string | null>(null);
  const [dnsOk, setDnsOk] = useState<boolean | null>(null);

  const availableCurrenciesToAdd = useMemo(() => {
    const selected = new Set(paymentCurrencies.map((c) => c.toUpperCase()));
    return ADD_MARKET_CURRENCY_OPTIONS.filter(
      (c) => !selected.has(c) && isPaymentCurrencyGatewaySupported(c),
    );
  }, [paymentCurrencies]);

  const unsupportedCurrenciesShown = useMemo(() => {
    const selected = new Set(paymentCurrencies.map((c) => c.toUpperCase()));
    return ADD_MARKET_CURRENCY_OPTIONS.filter(
      (c) => !selected.has(c) && !isPaymentCurrencyGatewaySupported(c),
    );
  }, [paymentCurrencies]);

  function setUrlMarketCode(code: string | null) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("marketCode", code);
    else url.searchParams.delete("marketCode");
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  const hydrateForm = useCallback((next: WizardState) => {
    setNameEn(next.identity.nameEn);
    setNameAr(next.identity.nameAr);
    setDefaultCurrency(next.identity.defaultCurrency);
    setPaymentCurrencies(next.identity.paymentCurrencies);
    setGeoCountries(next.identity.geoCountryCodes.join(", "));
    setPapersComplete(next.papersComplete);
    setDnsOk(next.routing.hostRoutingConfirmed ? true : null);
    if (next.commercial) {
      setPlatformRate(String(Math.round(next.commercial.platformRate * 1000) / 10));
      setPlatformRateCross(String(Math.round(next.commercial.platformRateCross * 1000) / 10));
      setReturnDays(String(next.commercial.returnWindowDays));
      setSettlementDays(String(next.commercial.settlementWindowDays));
      setVatRate(String(Math.round(next.commercial.vatRate * 1000) / 10));
      setCodEnabled(next.commercial.codEnabled);
    }
  }, []);

  const loadCountries = useCallback(async () => {
    const res = await fetch("/api/v1/admin/markets/wizard", { credentials: "include" });
    if (!res.ok) throw new Error("load");
    const data = (await res.json()) as {
      countries: CountryOption[];
      drafts?: DraftSummary[];
    };
    setCountries(data.countries ?? []);
    setDrafts(data.drafts ?? []);
  }, []);

  const loadDraft = useCallback(
    async (code: string) => {
      const res = await fetch(
        `/api/v1/admin/markets/wizard?marketCode=${encodeURIComponent(code)}`,
        { credentials: "include" },
      );
      const data = (await res.json().catch(() => null)) as
        | { state?: WizardState; error?: string }
        | null;
      if (!res.ok || !data?.state) throw new Error(data?.error ?? ui.loadError);
      setState(data.state);
      hydrateForm(data.state);
      setMarketCode(data.state.marketCode);
      setUrlMarketCode(data.state.marketCode);
    },
    [hydrateForm, ui.loadError],
  );

  const startWizard = useCallback(
    async (countryCode: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/v1/admin/markets/wizard", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ countryCode, cloneFrom: "OM" }),
        });
        const data = (await res.json().catch(() => null)) as
          | { state?: WizardState; error?: string }
          | null;
        if (!res.ok || !data?.state) throw new Error(data?.error ?? ui.loadError);
        setState(data.state);
        hydrateForm(data.state);
        setMarketCode(data.state.marketCode);
        setUrlMarketCode(data.state.marketCode);
        toast.success(ui.saved);
        await loadCountries();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : ui.loadError);
      } finally {
        setBusy(false);
      }
    },
    [hydrateForm, loadCountries, toast, ui.loadError, ui.saved],
  );

  const deleteDraft = useCallback(
    async (code: string) => {
      if (!window.confirm(ui.deleteDraftConfirm.replace("{code}", code))) return;
      setBusy(true);
      try {
        const res = await fetch(
          `/api/v1/admin/markets/wizard?marketCode=${encodeURIComponent(code)}`,
          { method: "DELETE", credentials: "include" },
        );
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error ?? ui.saveError);
        if (marketCode === code) {
          setState(null);
          setMarketCode("");
          setUrlMarketCode(null);
        }
        toast.success(ui.deleted);
        await loadCountries();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : ui.saveError);
      } finally {
        setBusy(false);
      }
    },
    [loadCountries, marketCode, toast, ui.deleteDraftConfirm, ui.deleted, ui.saveError],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadCountries();
        const fromUrl =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("marketCode")?.trim().toUpperCase()
            : null;
        if (fromUrl) {
          await loadDraft(fromUrl);
        }
      } catch {
        toast.error(ui.loadError);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  async function patchStep(stepName: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/admin/markets/wizard/step?marketCode=${encodeURIComponent(marketCode)}&step=${stepName}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json().catch(() => null)) as
        | { state?: WizardState; error?: string }
        | null;
      if (!res.ok || !data?.state) throw new Error(data?.error ?? ui.saveError);
      setState(data.state);
      hydrateForm(data.state);
      toast.success(ui.saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/admin/markets/wizard/publish?marketCode=${encodeURIComponent(marketCode)}`,
        { method: "POST", credentials: "include" },
      );
      const data = (await res.json().catch(() => null)) as
        | { state?: WizardState; error?: string; migratedVendors?: number }
        | null;
      if (!res.ok || !data?.state) throw new Error(data?.error ?? ui.saveError);
      setState(data.state);
      toast.success(
        `${ui.publishSuccess} (${ui.migrateNote}: ${data.migratedVendors ?? 0})`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  const stepLabel = (id: (typeof STEPS)[number]) => {
    switch (id) {
      case "identity":
        return ui.stepIdentity;
      case "annex":
        return ui.stepAnnex;
      case "commercial":
        return ui.stepCommercial;
      case "shipping":
        return ui.stepShipping;
      case "payments":
        return ui.stepPayments;
      case "legal":
        return ui.stepLegal;
      case "papers":
        return ui.stepPapers;
      case "review":
        return ui.stepReview;
    }
  };

  return (
    <div className="mt-8 space-y-6">
      {!state ? (
        <div className="space-y-6">
          {drafts.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <p className="text-sm font-medium">{ui.resumeDrafts}</p>
              <div className="space-y-2">
                {drafts.map((d) => {
                  const label = locale === "ar" ? d.nameAr : d.nameEn;
                  return (
                    <div
                      key={d.marketCode}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <div>
                        <p>
                          {label} ({d.marketCode}) · {d.lifecycleStatus}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{d.subdomain}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary btn-press text-xs disabled:opacity-50"
                          disabled={busy}
                          onClick={() => {
                            void (async () => {
                              setBusy(true);
                              try {
                                await loadDraft(d.marketCode);
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : ui.loadError);
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          {ui.resume}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-600 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void deleteDraft(d.marketCode)}
                        >
                          {ui.deleteDraft}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm text-[var(--muted)]">{ui.selectMarket}</p>
            <p className="text-xs text-[var(--muted)]">{ui.cloneFromOm}</p>
            {countries.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{ui.noCountries}</p>
            ) : (
              <div className="space-y-2">
                {countries.map((m) => {
                  const label = locale === "ar" ? m.nameAr : m.nameEn;
                  const currencyOk = isPaymentCurrencyGatewaySupported(m.defaultCurrency);
                  return (
                    <button
                      key={m.countryCode}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm hover:border-[var(--primary)] disabled:opacity-50"
                      disabled={busy || !currencyOk}
                      title={!currencyOk ? ui.unsupportedCurrency : undefined}
                      onClick={() => void startWizard(m.countryCode)}
                    >
                      <span>
                        {label} ({m.countryCode})
                        {!currencyOk ? (
                          <span className="ms-2 text-xs text-[var(--muted)]">
                            ({ui.unsupportedCurrency})
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {m.defaultCurrency} · {m.subdomain}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {STEPS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-full px-2.5 py-1 ${
                    step === id
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--foreground)]"
                  }`}
                  onClick={() => setStep(id)}
                >
                  {stepLabel(id)}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(state.lifecycleStatus === "DRAFT" || state.lifecycleStatus === "READY") &&
              !state.isActive ? (
                <button
                  type="button"
                  className="text-xs text-red-600 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void deleteDraft(state.marketCode)}
                >
                  {ui.deleteDraft}
                </button>
              ) : null}
              <button
                type="button"
                className="text-xs text-link disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  setState(null);
                  setMarketCode("");
                  setUrlMarketCode(null);
                  void loadCountries();
                }}
              >
                {ui.closeWizard}
              </button>
            </div>
          </div>

          <p className="text-sm text-[var(--muted)]">
            {state.marketCode} · {ui.status}: {state.lifecycleStatus}
            {state.cloneSourceCode ? ` · clone: ${state.cloneSourceCode}` : ""}
          </p>

          {step === "identity" ? (
            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <label className="block space-y-1 text-sm">
                <span>{ui.nameEn}</span>
                <input className="app-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span>{ui.nameAr}</span>
                <input className="app-input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span>{ui.defaultCurrency}</span>
                <select
                  className="app-input"
                  value={defaultCurrency}
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase();
                    if (!isPaymentCurrencyGatewaySupported(next)) return;
                    setDefaultCurrency(next);
                    setPaymentCurrencies((prev) =>
                      prev.includes(next) ? prev : [...prev, next],
                    );
                  }}
                >
                  {[defaultCurrency, ...availableCurrenciesToAdd]
                    .filter((c, i, arr) => c && arr.indexOf(c) === i)
                    .filter((c) => isPaymentCurrencyGatewaySupported(c))
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </label>
              <div className="space-y-2 text-sm">
                <span className="font-medium">{ui.paymentCurrencies}</span>
                <p className="text-xs text-[var(--muted)]">{ui.unsupportedCurrencyHint}</p>
                <div className="flex flex-wrap gap-2">
                  {paymentCurrencies.map((c) => {
                    const ok = isPaymentCurrencyGatewaySupported(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`rounded-full border px-2.5 py-1 text-xs ${
                          ok
                            ? "border-[var(--border)] hover:border-red-500"
                            : "cursor-not-allowed border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_18%,transparent)] text-[var(--muted)] opacity-70"
                        }`}
                        title={ok ? ui.removeCurrency : ui.unsupportedCurrency}
                        disabled={!ok && c === defaultCurrency}
                        onClick={() => {
                          if (!ok) {
                            // Drop unsupported leftover from older drafts.
                            if (c !== defaultCurrency) {
                              setPaymentCurrencies((prev) => prev.filter((x) => x !== c));
                            }
                            return;
                          }
                          if (c === defaultCurrency) return;
                          setPaymentCurrencies((prev) => prev.filter((x) => x !== c));
                        }}
                      >
                        {c}
                        {!ok ? ` · ${ui.unsupportedCurrency}` : c !== defaultCurrency ? " ×" : ""}
                      </button>
                    );
                  })}
                </div>
                {availableCurrenciesToAdd.length > 0 ? (
                  <label className="block space-y-1">
                    <span className="text-xs text-[var(--muted)]">{ui.addCurrency}</span>
                    <select
                      className="app-input"
                      value=""
                      onChange={(e) => {
                        const next = e.target.value.toUpperCase();
                        if (!next || !isPaymentCurrencyGatewaySupported(next)) return;
                        setPaymentCurrencies((prev) =>
                          prev.includes(next) ? prev : [...prev, next],
                        );
                      }}
                    >
                      <option value="">—</option>
                      {availableCurrenciesToAdd.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {unsupportedCurrenciesShown.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted)]">{ui.unsupportedCurrency}</p>
                    <div className="flex flex-wrap gap-2">
                      {unsupportedCurrenciesShown.map((c) => (
                        <span
                          key={c}
                          className="cursor-not-allowed rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_18%,transparent)] px-2.5 py-1 text-xs text-[var(--muted)] opacity-70"
                          title={ui.unsupportedCurrency}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <label className="block space-y-1 text-sm">
                <span>{ui.geoCountries}</span>
                <input
                  className="app-input"
                  value={geoCountries}
                  onChange={(e) => setGeoCountries(e.target.value.toUpperCase())}
                />
              </label>
              <button
                type="button"
                className="btn-primary btn-press text-sm disabled:opacity-50"
                disabled={busy}
                onClick={() =>
                  void patchStep("identity", {
                    nameEn,
                    nameAr,
                    defaultCurrency,
                    paymentCurrencies,
                    geoCountryCodes: geoCountries
                      .split(/[,\s]+/)
                      .map((c) => c.trim())
                      .filter((c) => c.length === 2),
                  })
                }
              >
                {ui.saveIdentity}
              </button>
            </section>
          ) : null}

          {step === "annex" ? (
            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <WizardAnnexEditor
                marketCode={state.marketCode}
                labels={{
                  loading: ui.loading,
                  loadError: ui.loadError,
                  saveError: ui.saveError,
                  saved: ui.saved,
                  saveAnnex: ui.saveAnnex,
                  legalNameEn: ui.legalNameEn,
                  legalNameAr: ui.legalNameAr,
                  cr: ui.cr,
                  unifiedNumber: ui.unifiedNumber,
                  address: ui.address,
                  city: ui.city,
                  countryCode: ui.countryCode,
                  phone: ui.phone,
                  email: ui.email,
                  annexHint: ui.annexHint,
                  openAnnex: ui.openAnnex,
                }}
              />
            </section>
          ) : null}

          {step === "commercial" ? (
            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <label className="block space-y-1 text-sm">
                <span>{ui.platformRate} (%)</span>
                <input className="app-input" value={platformRate} onChange={(e) => setPlatformRate(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span>{ui.platformRateCross} (%)</span>
                <input
                  className="app-input"
                  value={platformRateCross}
                  onChange={(e) => setPlatformRateCross(e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>{ui.returnDays}</span>
                <input className="app-input" value={returnDays} onChange={(e) => setReturnDays(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span>{ui.settlementDays}</span>
                <input
                  className="app-input"
                  value={settlementDays}
                  onChange={(e) => setSettlementDays(e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>{ui.vatRate} (%)</span>
                <input className="app-input" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={codEnabled}
                  onChange={(e) => setCodEnabled(e.target.checked)}
                />
                {ui.codEnabled}
              </label>
              <button
                type="button"
                className="btn-primary btn-press text-sm disabled:opacity-50"
                disabled={busy}
                onClick={() =>
                  void patchStep("commercial", {
                    platformRate: Number(platformRate) / 100,
                    platformRateCross: Number(platformRateCross) / 100,
                    returnWindowDays: Number(returnDays),
                    settlementWindowDays: Number(settlementDays),
                    vatRate: Number(vatRate) / 100,
                    codEnabled,
                  })
                }
              >
                {ui.saveCommercial}
              </button>
            </section>
          ) : null}

          {step === "shipping" ? (
            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <WizardShippingEditor
                marketCode={state.marketCode}
                labels={{
                  loading: ui.loading,
                  loadError: ui.loadError,
                  saveError: ui.saveError,
                  saved: ui.saved,
                  shippingHint: ui.shippingHint,
                  amount: ui.shippingAmount,
                  active: ui.shippingActive,
                  saveRate: ui.saveRate,
                  empty: ui.shippingEmpty,
                }}
              />
            </section>
          ) : null}

          {step === "payments" ? (
            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <h2 className="text-sm font-semibold">{ui.gatewayMatrix}</h2>
              <p className="text-xs text-[var(--muted)]">
                Gateways: {state.gateway.configuredGateways.join(", ") || "—"}
              </p>
              <ul className="space-y-1 text-sm">
                {state.gateway.matrix.map((row) => (
                  <li key={row.currency} className="flex justify-between gap-2">
                    <span>{row.currency}</span>
                    <span className={row.covered ? "text-emerald-700" : "text-red-600"}>
                      {row.covered
                        ? `${ui.covered} (${row.supportedBy.join(", ")})`
                        : ui.notCovered}
                    </span>
                  </li>
                ))}
              </ul>
              {state.gateway.uncovered.length > 0 ? (
                <p className="text-sm text-red-600">
                  {ui.uncovered}: {state.gateway.uncovered.join(", ")}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === "legal" ? (
            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <WizardLegalEditor
                marketCode={state.marketCode}
                labels={{
                  loading: ui.loading,
                  loadError: ui.loadError,
                  saveError: ui.saveError,
                  saved: ui.saved,
                  legalHint: ui.legalHintInline,
                  openLegal: ui.openLegal,
                  savePolicy: ui.savePolicy,
                  titleEn: ui.titleEn,
                  titleAr: ui.titleAr,
                  bodyEn: ui.bodyEn,
                  bodyAr: ui.bodyAr,
                  draft: ui.draft,
                  published: ui.published,
                  selectDoc: ui.selectDoc,
                }}
              />
            </section>
          ) : null}

          {step === "papers" ? (
            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <p className="text-sm text-[var(--muted)]">{ui.papersHint}</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={papersComplete}
                  onChange={(e) => setPapersComplete(e.target.checked)}
                />
                {ui.papersComplete}
              </label>
              <button
                type="button"
                className="btn-primary btn-press text-sm disabled:opacity-50"
                disabled={busy}
                onClick={() => void patchStep("papers", { papersComplete })}
              >
                {ui.savePapers}
              </button>
            </section>
          ) : null}

          {step === "review" ? (
            <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
              <h2 className="text-sm font-semibold">{ui.checklistTitle}</h2>
              <ul className="space-y-1 text-sm">
                {state.checklist.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span>{item.id}</span>
                    <span className={item.ok ? "text-emerald-700" : "text-red-600"}>
                      {item.ok ? "OK" : item.detail || "—"}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="rounded-lg border border-[var(--border)] p-3 text-sm space-y-3">
                <div>
                  <h3 className="font-semibold">{ui.routingTitle}</h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">{ui.routingHint}</p>
                  <ul className="mt-2 space-y-1">
                    <li className="flex justify-between gap-2">
                      <span>{ui.routingHost}</span>
                      <span className={state.routing.hostBound ? "text-emerald-700" : "text-red-600"}>
                        {state.routing.subdomain || "—"} → {state.routing.detail.hostResolvesTo || "?"}
                        {state.routing.hostBound ? " ✓" : ""}
                      </span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span>{ui.routingGeo}</span>
                      <span className={state.routing.geoBound ? "text-emerald-700" : "text-red-600"}>
                        {state.routing.geoCountryCodes.join(", ") || "—"}
                        {state.routing.geoBound ? " ✓" : ""}
                      </span>
                    </li>
                  </ul>
                </div>
                <p className="text-xs text-[var(--muted)]">{ui.hostConfirmHint}</p>
                <p className="text-xs text-[var(--muted)]">
                  {ui.hostConfirmLabel.replace("{subdomain}", state.routing.subdomain || "—")}
                </p>
                <button
                  type="button"
                  className="btn-secondary btn-press text-sm disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      setDnsMessage(null);
                      try {
                        const res = await fetch(
                          `/api/v1/admin/markets/wizard/step?marketCode=${encodeURIComponent(marketCode)}&step=verify-host`,
                          {
                            method: "PATCH",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: "{}",
                          },
                        );
                        const data = (await res.json().catch(() => null)) as {
                          state?: WizardState;
                          dns?: { ok: boolean; detail: string; hostname: string };
                          error?: string;
                        } | null;
                        if (!res.ok || !data?.state) throw new Error(data?.error ?? ui.saveError);
                        setState(data.state);
                        hydrateForm(data.state);
                        setDnsOk(data.dns?.ok ?? data.state.routing.hostRoutingConfirmed);
                        setDnsMessage(
                          data.dns
                            ? `${data.dns.ok ? ui.dnsPass : ui.dnsFail}: ${data.dns.detail}`
                            : null,
                        );
                        if (data.dns?.ok) toast.success(ui.dnsPass);
                        else toast.error(ui.dnsFail);
                      } catch (e) {
                        setDnsOk(false);
                        toast.error(e instanceof Error ? e.message : ui.saveError);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  {busy ? ui.verifyingDns : ui.verifyDns}
                </button>
                {dnsMessage ? (
                  <p className={`text-xs ${dnsOk ? "text-emerald-700" : "text-red-600"}`}>{dnsMessage}</p>
                ) : null}
                <p
                  className={`text-xs ${state.routing.routingOk ? "text-emerald-700" : "text-red-600"}`}
                >
                  {state.routing.routingOk ? ui.routingReady : ui.routingBlocked}
                </p>
              </div>

              {state.blockers.length > 0 ? (
                <p className="text-sm text-red-600">
                  {ui.blockers}: {state.blockers.join(", ")}
                </p>
              ) : null}
              <p className="text-xs text-[var(--muted)]">{ui.migrateNote}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary btn-press text-sm disabled:opacity-50"
                  disabled={busy || !state.canMarkReady}
                  onClick={() => void patchStep("ready", {})}
                >
                  {ui.markReady}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-press text-sm disabled:opacity-50"
                  disabled={busy || !state.canPublish || !state.routing.routingOk}
                  onClick={() => void publish()}
                >
                  {busy ? ui.publishing : ui.publish}
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
