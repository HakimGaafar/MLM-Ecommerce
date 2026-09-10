"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { MarketCode } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";

type MarketOption = {
  code: MarketCode;
  label: string;
  currency: string;
};

type ConfigState = {
  cashbackPercent: number;
  affiliatePoolPercent: number;
  affiliateLevel1Percent: number;
  affiliateLevel2Percent: number;
  affiliateLevel3Percent: number;
  affiliateLevel4Percent: number;
  vendorPercent: number;
  platformPercent: number;
  vatPercent: number;
  minWithdrawalAmount: number;
  returnWindowDays: number;
  settlementWindowDays: number;
  referralDepthMax: number;
  missingAncestorPolicy: "KEEP_BY_PLATFORM" | "REDISTRIBUTE_TO_EXISTING_LEVELS";
  termsUrl: string;
  termsText: string;
  privacyUrl: string;
  privacyText: string;
  returnPolicyUrl: string;
  returnPolicyText: string;
  footerTaglineEn: string;
  footerTaglineAr: string;
  contactLocationEn: string;
  contactLocationAr: string;
  publicContactEmail: string;
  inquiryNotifyEmail: string;
  showTapGateway: boolean;
  showHyperPayGateway: boolean;
  showMyFatoorahGateway: boolean;
  currency: string;
  updatedAt: string | null;
};

type ApiConfigState = Omit<
  ConfigState,
  | "affiliateLevel1Percent"
  | "affiliateLevel2Percent"
  | "affiliateLevel3Percent"
  | "affiliateLevel4Percent"
> & {
  affiliateLevelPercents?: [number, number, number, number];
  affiliateLevel1Percent?: number;
  affiliateLevel2Percent?: number;
  affiliateLevel3Percent?: number;
  affiliateLevel4Percent?: number;
};

type Ui = {
  loading: string;
  loadError: string;
  saveError: string;
  saved: string;
  saving: string;
  save: string;
  marketLabel: string;
  currencyLabel: string;
  relatedTitle: string;
  relatedCategories: string;
  relatedBanners: string;
  relatedShipping: string;
  relatedAffiliates: string;
  sections: {
    cashback: string;
    affiliate: string;
    commission: string;
    tax: string;
    withdrawal: string;
    returns: string;
    settlement: string;
    referralStructure: string;
    policies: string;
    footerContact: string;
    paymentGateways: string;
  };
  fields: {
    cashbackPercent: string;
    affiliatePoolPercent: string;
    affiliateLevel1Percent: string;
    affiliateLevel2Percent: string;
    affiliateLevel3Percent: string;
    affiliateLevel4Percent: string;
    vendorPercent: string;
    platformPercent: string;
    vatPercent: string;
    minWithdrawalAmount: string;
    returnWindowDays: string;
    settlementWindowDays: string;
    referralDepthMax: string;
    missingAncestorPolicy: string;
    termsUrl: string;
    termsText: string;
    privacyUrl: string;
    privacyText: string;
    returnPolicyUrl: string;
    returnPolicyText: string;
    footerTaglineEn: string;
    footerTaglineAr: string;
    contactLocationEn: string;
    contactLocationAr: string;
    publicContactEmail: string;
    inquiryNotifyEmail: string;
    showTapGateway: string;
    showHyperPayGateway: string;
    showMyFatoorahGateway: string;
  };
  hints: {
    affiliateIntro: string;
    affiliateLevels: string;
    commissionIntro: string;
    commissionSplit: string;
    commissionSum: string;
    commissionSumOk: string;
    commissionSumBad: string;
    vatIntro: string;
    vatExample: string;
    appliesToNewOrders: string;
    policiesOptional: string;
    footerContact: string;
    paymentGateways: string;
    settlementWindow: string;
    missingAncestorKeep: string;
    missingAncestorRedistribute: string;
  };
  viewAuditLog: string;
  lastUpdated: string;
  neverUpdated: string;
};

function toFormState(config: ApiConfigState): ConfigState {
  const levels = config.affiliateLevelPercents ?? [
    config.affiliateLevel1Percent ?? 0,
    config.affiliateLevel2Percent ?? 0,
    config.affiliateLevel3Percent ?? 0,
    config.affiliateLevel4Percent ?? 0,
  ];
  return {
    ...config,
    affiliateLevel1Percent: levels[0] ?? 0,
    affiliateLevel2Percent: levels[1] ?? 0,
    affiliateLevel3Percent: levels[2] ?? 0,
    affiliateLevel4Percent: levels[3] ?? 0,
    termsUrl: config.termsUrl ?? "",
    termsText: config.termsText ?? "",
    privacyUrl: config.privacyUrl ?? "",
    privacyText: config.privacyText ?? "",
    returnPolicyUrl: config.returnPolicyUrl ?? "",
    returnPolicyText: config.returnPolicyText ?? "",
    footerTaglineEn: config.footerTaglineEn ?? "",
    footerTaglineAr: config.footerTaglineAr ?? "",
    contactLocationEn: config.contactLocationEn ?? "",
    contactLocationAr: config.contactLocationAr ?? "",
    publicContactEmail: config.publicContactEmail ?? "",
    inquiryNotifyEmail: config.inquiryNotifyEmail ?? "",
  };
}

function SettingsField({
  label,
  className,
  alignLabelHeights = false,
  children,
}: {
  label: string;
  className?: string;
  alignLabelHeights?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-2 text-sm ${className ?? ""}`}>
      <span
        className={
          alignLabelHeights
            ? "flex min-h-16 items-end leading-snug text-[var(--muted)]"
            : "leading-snug text-[var(--muted)]"
        }
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export default function AdminPlatformSettingsForm({
  locale,
  ui,
  markets,
  initialMarketCode,
}: {
  locale: Locale;
  ui: Ui;
  markets: MarketOption[];
  initialMarketCode: MarketCode;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const toast = useToast();
  const [marketCode, setMarketCode] = useState<MarketCode>(initialMarketCode);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigState | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/settings?marketCode=${marketCode}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const json = (await res.json()) as { config: ApiConfigState };
      setForm(toFormState(json.config));
      setUpdatedAt(json.config.updatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [marketCode, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const setNumber = (key: keyof ConfigState, value: string) => {
    const parsed = Number(value);
    setForm((prev) => (prev ? { ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 } : prev));
  };

  const setText = (key: keyof ConfigState, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const setBoolean = (key: keyof ConfigState, value: boolean) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onSave = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/settings?marketCode=${marketCode}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        config?: ApiConfigState;
      } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.saveError);
      if (payload?.config) {
        setForm(toFormState(payload.config));
        setUpdatedAt(payload.config.updatedAt);
      }
      toast.success(ui.saved);
    } catch (e) {
      const message = e instanceof Error ? e.message : ui.saveError;
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const minWithdrawalLabel = ui.fields.minWithdrawalAmount.replace("{currency}", form?.currency ?? "—");
  const commissionSum = form
    ? Math.round((form.vendorPercent + form.platformPercent) * 100) / 100
    : 0;
  const commissionOk = Math.abs(commissionSum - 100) < 0.011;

  return (
    <div className="mt-8 space-y-8" dir={direction}>
      <div className="rounded-xl border border-[var(--border)] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-[var(--muted)]">{ui.marketLabel}</span>
            <select
              className="app-input"
              value={marketCode}
              disabled={loading || saving}
              onChange={(e) => setMarketCode(e.target.value as MarketCode)}
            >
              {markets.map((market) => (
                <option key={market.code} value={market.code}>
                  {market.label} ({market.currency})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-[var(--muted)]">{ui.currencyLabel}</span>
            <input
              className="app-input"
              readOnly
              value={form?.currency ?? "—"}
            />
          </label>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium">{ui.relatedTitle}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link href="/admin/catalog/categories" className="text-link font-medium">
              {ui.relatedCategories}
            </Link>
            <Link href="/admin/catalog/banners" className="text-link font-medium">
              {ui.relatedBanners}
            </Link>
            <Link href="/admin/shipping/rates" className="text-link font-medium">
              {ui.relatedShipping}
            </Link>
            <Link href="/admin/affiliates" className="text-link font-medium">
              {ui.relatedAffiliates}
            </Link>
          </div>
        </div>
      </div>

      {loading ? <p className="text-sm text-[var(--muted)]">{ui.loading}</p> : null}

      {error && !form ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {form ? (
        <>
          <p className="text-sm text-[var(--muted)]">{ui.hints.appliesToNewOrders}</p>
          <p className="text-xs text-[var(--muted)]">
            {updatedAt
              ? `${ui.lastUpdated} ${new Date(updatedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB")}`
              : ui.neverUpdated}
          </p>

          <section className="rounded-xl border border-border p-6">
            <h2 className="text-lg font-medium">{ui.sections.paymentGateways}</h2>
            <p className="mt-1 text-xs text-(--muted)">{ui.hints.paymentGateways}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["showTapGateway", ui.fields.showTapGateway],
                  ["showHyperPayGateway", ui.fields.showHyperPayGateway],
                  ["showMyFatoorahGateway", ui.fields.showMyFatoorahGateway],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(event) => setBoolean(key, event.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.cashback}</h2>
            <SettingsField label={ui.fields.cashbackPercent} className="mt-4 max-w-xs">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="app-input"
                value={form.cashbackPercent}
                onChange={(e) => setNumber("cashbackPercent", e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </SettingsField>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.affiliate}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{ui.hints.affiliateIntro}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{ui.hints.affiliateLevels}</p>
            <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["affiliatePoolPercent", ui.fields.affiliatePoolPercent],
                  ["affiliateLevel1Percent", ui.fields.affiliateLevel1Percent],
                  ["affiliateLevel2Percent", ui.fields.affiliateLevel2Percent],
                  ["affiliateLevel3Percent", ui.fields.affiliateLevel3Percent],
                  ["affiliateLevel4Percent", ui.fields.affiliateLevel4Percent],
                ] as const
              ).map(([key, label]) => (
                <SettingsField key={key} label={label} alignLabelHeights>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    className="app-input"
                    value={form[key]}
                    onChange={(e) => setNumber(key, e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </SettingsField>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.commission}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{ui.hints.commissionIntro}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">{ui.hints.commissionSplit}</p>
            <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <SettingsField label={ui.fields.vendorPercent} alignLabelHeights>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className="app-input"
                  value={form.vendorPercent}
                  onChange={(e) => setNumber("vendorPercent", e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </SettingsField>
              <SettingsField label={ui.fields.platformPercent} alignLabelHeights>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className="app-input"
                  value={form.platformPercent}
                  onChange={(e) => setNumber("platformPercent", e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </SettingsField>
            </div>
            <p
              className={`mt-3 text-sm font-medium ${
                commissionOk ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {ui.hints.commissionSum.replace("{sum}", String(commissionSum))} —{" "}
              {commissionOk ? ui.hints.commissionSumOk : ui.hints.commissionSumBad}
            </p>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.tax}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{ui.hints.vatIntro}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{ui.hints.vatExample}</p>
            <SettingsField label={ui.fields.vatPercent} className="mt-4 max-w-xs">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="app-input"
                value={form.vatPercent}
                onChange={(e) => setNumber("vatPercent", e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </SettingsField>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.withdrawal}</h2>
            <SettingsField label={minWithdrawalLabel} className="mt-4 max-w-xs">
              <input
                type="number"
                min={1}
                step={1}
                className="app-input"
                value={form.minWithdrawalAmount}
                onChange={(e) => setNumber("minWithdrawalAmount", e.target.value)}
              />
            </SettingsField>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.returns}</h2>
            <SettingsField label={ui.fields.returnWindowDays} className="mt-4 max-w-xs">
              <input
                type="number"
                min={1}
                max={365}
                step={1}
                className="app-input"
                value={form.returnWindowDays}
                onChange={(e) => setNumber("returnWindowDays", e.target.value)}
              />
            </SettingsField>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.settlement}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">{ui.hints.settlementWindow}</p>
            <SettingsField label={ui.fields.settlementWindowDays} className="mt-4 max-w-xs">
              <input
                type="number"
                min={1}
                max={90}
                step={1}
                className="app-input"
                value={form.settlementWindowDays}
                onChange={(e) => setNumber("settlementWindowDays", e.target.value)}
              />
            </SettingsField>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.referralStructure}</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <SettingsField label={ui.fields.referralDepthMax}>
                <input
                  type="number"
                  min={1}
                  max={4}
                  step={1}
                  className="app-input"
                  value={form.referralDepthMax}
                  onChange={(e) => setNumber("referralDepthMax", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.missingAncestorPolicy}>
                <select
                  className="app-input"
                  value={form.missingAncestorPolicy}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            missingAncestorPolicy: e.target.value as ConfigState["missingAncestorPolicy"],
                          }
                        : prev,
                    )
                  }
                >
                  <option value="KEEP_BY_PLATFORM">{ui.hints.missingAncestorKeep}</option>
                  <option value="REDISTRIBUTE_TO_EXISTING_LEVELS">
                    {ui.hints.missingAncestorRedistribute}
                  </option>
                </select>
              </SettingsField>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.policies}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">{ui.hints.policiesOptional}</p>
            <div className="mt-4 grid gap-6">
              <SettingsField label={ui.fields.termsUrl}>
                <input
                  type="url"
                  className="app-input"
                  value={form.termsUrl}
                  onChange={(e) => setText("termsUrl", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.termsText}>
                <textarea
                  rows={3}
                  className="app-input"
                  value={form.termsText}
                  onChange={(e) => setText("termsText", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.privacyUrl}>
                <input
                  type="url"
                  className="app-input"
                  value={form.privacyUrl}
                  onChange={(e) => setText("privacyUrl", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.privacyText}>
                <textarea
                  rows={3}
                  className="app-input"
                  value={form.privacyText}
                  onChange={(e) => setText("privacyText", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.returnPolicyUrl}>
                <input
                  type="url"
                  className="app-input"
                  value={form.returnPolicyUrl}
                  onChange={(e) => setText("returnPolicyUrl", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.returnPolicyText}>
                <textarea
                  rows={3}
                  className="app-input"
                  value={form.returnPolicyText}
                  onChange={(e) => setText("returnPolicyText", e.target.value)}
                />
              </SettingsField>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.footerContact}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">{ui.hints.footerContact}</p>
            <div className="mt-4 grid gap-6">
              <SettingsField label={ui.fields.footerTaglineEn}>
                <textarea
                  rows={2}
                  className="app-input"
                  dir="ltr"
                  value={form.footerTaglineEn}
                  onChange={(e) => setText("footerTaglineEn", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.footerTaglineAr}>
                <textarea
                  rows={2}
                  className="app-input"
                  dir="rtl"
                  value={form.footerTaglineAr}
                  onChange={(e) => setText("footerTaglineAr", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.contactLocationEn}>
                <textarea
                  rows={3}
                  className="app-input"
                  dir="ltr"
                  value={form.contactLocationEn}
                  onChange={(e) => setText("contactLocationEn", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.contactLocationAr}>
                <textarea
                  rows={3}
                  className="app-input"
                  dir="rtl"
                  value={form.contactLocationAr}
                  onChange={(e) => setText("contactLocationAr", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.publicContactEmail}>
                <input
                  type="email"
                  className="app-input"
                  value={form.publicContactEmail}
                  onChange={(e) => setText("publicContactEmail", e.target.value)}
                />
              </SettingsField>
              <SettingsField label={ui.fields.inquiryNotifyEmail}>
                <input
                  type="email"
                  className="app-input"
                  value={form.inquiryNotifyEmail}
                  onChange={(e) => setText("inquiryNotifyEmail", e.target.value)}
                />
              </SettingsField>
            </div>
          </section>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={saving || !commissionOk}
            onClick={() => void onSave()}
            className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
          >
            {saving ? ui.saving : ui.save}
          </button>
        </>
      ) : null}
    </div>
  );
}
