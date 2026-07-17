"use client";

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
  termsUrl: string;
  termsText: string;
  privacyUrl: string;
  privacyText: string;
  returnPolicyUrl: string;
  returnPolicyText: string;
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
  sections: {
    cashback: string;
    affiliate: string;
    commission: string;
    tax: string;
    withdrawal: string;
    returns: string;
    policies: string;
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
    termsUrl: string;
    termsText: string;
    privacyUrl: string;
    privacyText: string;
    returnPolicyUrl: string;
    returnPolicyText: string;
    showTapGateway: string;
    showHyperPayGateway: string;
    showMyFatoorahGateway: string;
  };
  hints: {
    affiliateLevels: string;
    commissionSplit: string;
    appliesToNewOrders: string;
    policiesOptional: string;
    paymentGateways: string;
  };
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
              />
            </SettingsField>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.affiliate}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">{ui.hints.affiliateLevels}</p>
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
                  />
                </SettingsField>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.commission}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">{ui.hints.commissionSplit}</p>
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
                />
              </SettingsField>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-medium">{ui.sections.tax}</h2>
            <SettingsField label={ui.fields.vatPercent} className="mt-4 max-w-xs">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="app-input"
                value={form.vatPercent}
                onChange={(e) => setNumber("vatPercent", e.target.value)}
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

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={saving}
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
