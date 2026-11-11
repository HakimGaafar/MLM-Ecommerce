"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketCode, RefundFeeCause, RefundFeePayer } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";

type MarketOption = { code: MarketCode; nameEn: string; nameAr: string; isActive: boolean };

type Annex = {
  marketCode: MarketCode;
  isActive: boolean;
  defaultCurrency: string;
  paymentCurrencies: string[];
  issuer: {
    legalNameEn: string;
    legalNameAr: string;
    commercialRegistration: string | null;
    unifiedNumber: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string | null;
    countryCode: string;
    phone: string | null;
    email: string | null;
    consumerProtectionAuthorityEn: string | null;
    consumerProtectionAuthorityAr: string | null;
    vatRegistered: boolean;
    vatTrn: string | null;
    vatPercent: number;
    currency: string;
  } | null;
};

type InvoicingRule = {
  sellerMarketCode: MarketCode;
  buyerMarketCode: MarketCode;
  invoicingParty: "MERCHANT" | "PLATFORM";
  commissionPercent: number | null;
};

type RefundRule = { cause: RefundFeeCause; payer: RefundFeePayer };

type Ui = {
  loading: string;
  loadError: string;
  saveError: string;
  saved: string;
  saving: string;
  market: string;
  annexTitle: string;
  paymentCurrencies: string;
  paymentCurrenciesHint: string;
  defaultCurrency: string;
  legalNameEn: string;
  legalNameAr: string;
  cr: string;
  unifiedNumber: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  consumerAuthorityEn: string;
  consumerAuthorityAr: string;
  vatRegistered: string;
  vatTrn: string;
  vatPercent: string;
  saveAnnex: string;
  refundTitle: string;
  refundHint: string;
  saveRefund: string;
  invoicingTitle: string;
  invoicingHint: string;
  seller: string;
  buyer: string;
  party: string;
  commission: string;
  closedNote: string;
  causeLabels: Record<string, string>;
  payerLabels: Record<string, string>;
};

const CAUSES: RefundFeeCause[] = [
  "PRODUCT_DEFECT",
  "MERCHANT_MISTAKE",
  "PLATFORM_MISTAKE",
  "CUSTOMER_CHANGE_OF_MIND",
  "CUSTOMER_REFUSED_DELIVERY",
];

export default function AdminLegalFoundationsForm({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [marketCode, setMarketCode] = useState<MarketCode>("OM");
  const [annex, setAnnex] = useState<Annex | null>(null);
  const [refundRules, setRefundRules] = useState<RefundRule[]>([]);
  const [invoicingRules, setInvoicingRules] = useState<InvoicingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const marketLabel = useCallback(
    (m: MarketOption) => (locale === "ar" ? m.nameAr : m.nameEn),
    [locale],
  );

  const loadMarkets = useCallback(async () => {
    const res = await fetch("/api/v1/admin/markets", { credentials: "include" });
    if (!res.ok) throw new Error("load");
    const data = (await res.json()) as { markets: MarketOption[] };
    setMarkets(data.markets);
    if (data.markets.length > 0 && !data.markets.some((m) => m.code === marketCode)) {
      setMarketCode(data.markets[0]!.code);
    }
  }, [marketCode]);

  const loadAnnexAndRules = useCallback(async (code: MarketCode) => {
    const [annexRes, refundRes, invRes] = await Promise.all([
      fetch(`/api/v1/admin/markets/annex?marketCode=${code}`, { credentials: "include" }),
      fetch(`/api/v1/admin/refund-fee-rules?marketCode=${code}`, { credentials: "include" }),
      fetch("/api/v1/admin/invoicing-rules", { credentials: "include" }),
    ]);
    if (!annexRes.ok || !refundRes.ok || !invRes.ok) throw new Error("load");
    const annexData = (await annexRes.json()) as { annex: Annex };
    const refundData = (await refundRes.json()) as { rules: RefundRule[] };
    const invData = (await invRes.json()) as { rules: InvoicingRule[] };
    setAnnex(annexData.annex);
    setRefundRules(refundData.rules);
    setInvoicingRules(invData.rules);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadMarkets();
        if (!cancelled) await loadAnnexAndRules(marketCode);
      } catch {
        if (!cancelled) toast.error(ui.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAnnexAndRules, loadMarkets, marketCode, toast, ui.loadError]);

  const issuer = annex?.issuer;

  const refundByCause = useMemo(() => {
    const map = new Map(refundRules.map((r) => [r.cause, r.payer]));
    return CAUSES.map((cause) => ({
      cause,
      payer: map.get(cause) ?? ("MERCHANT" as RefundFeePayer),
    }));
  }, [refundRules]);

  async function saveAnnex() {
    if (!annex || !issuer) return;
    setSaving(true);
    try {
      const paymentCurrencies = annex.paymentCurrencies;
      const res = await fetch(`/api/v1/admin/markets/annex?marketCode=${marketCode}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentCurrencies,
          defaultCurrency: annex.defaultCurrency,
          legalNameEn: issuer.legalNameEn,
          legalNameAr: issuer.legalNameAr,
          commercialRegistration: issuer.commercialRegistration,
          unifiedNumber: issuer.unifiedNumber,
          addressLine1: issuer.addressLine1,
          addressLine2: issuer.addressLine2,
          city: issuer.city,
          postalCode: issuer.postalCode,
          countryCode: issuer.countryCode,
          phone: issuer.phone,
          email: issuer.email,
          consumerProtectionAuthorityEn: issuer.consumerProtectionAuthorityEn,
          consumerProtectionAuthorityAr: issuer.consumerProtectionAuthorityAr,
          vatRegistered: issuer.vatRegistered,
          vatTrn: issuer.vatTrn,
          vatPercent: issuer.vatPercent,
          currency: issuer.currency,
        }),
      });
      const data = (await res.json().catch(() => null)) as { annex?: Annex; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? ui.saveError);
      if (data?.annex) setAnnex(data.annex);
      toast.success(ui.saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function saveRefundRules() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/refund-fee-rules?marketCode=${marketCode}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: refundByCause }),
      });
      const data = (await res.json().catch(() => null)) as { rules?: RefundRule[]; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? ui.saveError);
      if (data?.rules) setRefundRules(data.rules);
      toast.success(ui.saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setSaving(false);
    }
  }

  function patchIssuer(patch: Partial<NonNullable<Annex["issuer"]>>) {
    setAnnex((prev) =>
      prev && prev.issuer ? { ...prev, issuer: { ...prev.issuer, ...patch } } : prev,
    );
  }

  if (loading) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  return (
    <div className="mt-8 space-y-8">
      <label className="flex max-w-sm flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">{ui.market}</span>
        <select
          className="app-input"
          value={marketCode}
          onChange={(e) => setMarketCode(e.target.value as MarketCode)}
        >
          {markets.map((m) => (
            <option key={m.code} value={m.code}>
              {marketLabel(m)} ({m.code}){m.isActive ? "" : " — closed"}
            </option>
          ))}
        </select>
      </label>

      {!annex?.isActive ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {ui.closedNote}
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-lg font-medium">{ui.annexTitle}</h2>
        {issuer ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">{ui.paymentCurrencies}</span>
              <input
                className="app-input"
                value={annex?.paymentCurrencies.join(", ") ?? ""}
                onChange={(e) =>
                  setAnnex((prev) =>
                    prev
                      ? {
                          ...prev,
                          paymentCurrencies: e.target.value
                            .split(/[,\s]+/)
                            .map((c) => c.trim().toUpperCase())
                            .filter((c) => /^[A-Z]{3}$/.test(c)),
                        }
                      : prev,
                  )
                }
              />
              <span className="text-xs text-[var(--muted)]">{ui.paymentCurrenciesHint}</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.defaultCurrency}</span>
              <input
                className="app-input"
                value={annex?.defaultCurrency ?? ""}
                onChange={(e) =>
                  setAnnex((prev) =>
                    prev ? { ...prev, defaultCurrency: e.target.value.trim().toUpperCase() } : prev,
                  )
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.legalNameEn}</span>
              <input
                className="app-input"
                value={issuer.legalNameEn}
                onChange={(e) => patchIssuer({ legalNameEn: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.legalNameAr}</span>
              <input
                className="app-input"
                value={issuer.legalNameAr}
                onChange={(e) => patchIssuer({ legalNameAr: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.cr}</span>
              <input
                className="app-input"
                value={issuer.commercialRegistration ?? ""}
                onChange={(e) => patchIssuer({ commercialRegistration: e.target.value || null })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.unifiedNumber}</span>
              <input
                className="app-input"
                value={issuer.unifiedNumber ?? ""}
                onChange={(e) => patchIssuer({ unifiedNumber: e.target.value || null })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">{ui.address}</span>
              <input
                className="app-input"
                value={issuer.addressLine1}
                onChange={(e) => patchIssuer({ addressLine1: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.city}</span>
              <input
                className="app-input"
                value={issuer.city}
                onChange={(e) => patchIssuer({ city: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.phone}</span>
              <input
                className="app-input"
                value={issuer.phone ?? ""}
                onChange={(e) => patchIssuer({ phone: e.target.value || null })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.email}</span>
              <input
                className="app-input"
                value={issuer.email ?? ""}
                onChange={(e) => patchIssuer({ email: e.target.value || null })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">{ui.consumerAuthorityEn}</span>
              <input
                className="app-input"
                value={issuer.consumerProtectionAuthorityEn ?? ""}
                onChange={(e) =>
                  patchIssuer({ consumerProtectionAuthorityEn: e.target.value || null })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">{ui.consumerAuthorityAr}</span>
              <input
                className="app-input"
                value={issuer.consumerProtectionAuthorityAr ?? ""}
                onChange={(e) =>
                  patchIssuer({ consumerProtectionAuthorityAr: e.target.value || null })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={issuer.vatRegistered}
                onChange={(e) => patchIssuer({ vatRegistered: e.target.checked })}
              />
              <span>{ui.vatRegistered}</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.vatTrn}</span>
              <input
                className="app-input"
                value={issuer.vatTrn ?? ""}
                onChange={(e) => patchIssuer({ vatTrn: e.target.value || null })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{ui.vatPercent}</span>
              <input
                className="app-input"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={issuer.vatPercent}
                onChange={(e) => patchIssuer({ vatPercent: Number(e.target.value) })}
              />
            </label>
            <button
              type="button"
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-60 sm:col-span-2 sm:w-fit"
              disabled={saving}
              onClick={() => void saveAnnex()}
            >
              {saving ? ui.saving : ui.saveAnnex}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">{ui.loadError}</p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
        <div>
          <h2 className="text-lg font-medium">{ui.refundTitle}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.refundHint}</p>
        </div>
        <div className="space-y-3">
          {refundByCause.map((row) => (
            <label key={row.cause} className="grid gap-2 text-sm sm:grid-cols-2 sm:items-center">
              <span>{ui.causeLabels[row.cause] ?? row.cause}</span>
              <select
                className="app-input"
                value={row.payer}
                onChange={(e) => {
                  const payer = e.target.value as RefundFeePayer;
                  setRefundRules((prev) => {
                    const next = prev.filter((r) => r.cause !== row.cause);
                    next.push({ cause: row.cause, payer });
                    return next;
                  });
                }}
              >
                {(["MERCHANT", "PLATFORM", "CUSTOMER"] as RefundFeePayer[]).map((p) => (
                  <option key={p} value={p}>
                    {ui.payerLabels[p] ?? p}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-60"
          disabled={saving}
          onClick={() => void saveRefundRules()}
        >
          {saving ? ui.saving : ui.saveRefund}
        </button>
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
        <div>
          <h2 className="text-lg font-medium">{ui.invoicingTitle}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.invoicingHint}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-3 font-medium">{ui.seller}</th>
                <th className="py-2 pr-3 font-medium">{ui.buyer}</th>
                <th className="py-2 pr-3 font-medium">{ui.party}</th>
                <th className="py-2 font-medium">{ui.commission}</th>
              </tr>
            </thead>
            <tbody>
              {invoicingRules.map((rule) => (
                <tr key={`${rule.sellerMarketCode}-${rule.buyerMarketCode}`} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">{rule.sellerMarketCode}</td>
                  <td className="py-2 pr-3">{rule.buyerMarketCode}</td>
                  <td className="py-2 pr-3">{rule.invoicingParty}</td>
                  <td className="py-2">
                    {rule.commissionPercent != null ? `${rule.commissionPercent}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
