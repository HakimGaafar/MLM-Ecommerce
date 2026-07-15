"use client";

import type { OrderReturnReason } from "@mlm/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type ReturnableUnit = {
  id: string;
  unitIndex: number | null;
  unitLabel: string | null;
  productName: string;
  lineTotal: string;
};

const REASON_ORDER: OrderReturnReason[] = [
  "DONT_WANT",
  "INCOMPLETE",
  "WRONG_ITEM",
  "COUNTERFEIT",
  "DEFECTIVE",
  "USED",
];

type WizardUi = {
  wizardStepUnits: string;
  wizardStepReason: string;
  wizardStepDetails: string;
  wizardStepPolicy: string;
  wizardNext: string;
  wizardBack: string;
  wizardSubmit: string;
  wizardSubmitting: string;
  wizardSubmitError: string;
  wizardPolicyIntro: string;
  wizardPolicyCheckbox: string;
  wizardDetailsHint: string;
  wizardSelectReason: string;
  wizardSelectUnits: string;
  wizardSelectUnitsHint: string;
  wizardUnitLabel: string;
  wizardLoadUnitsError: string;
};

export default function ReturnWizardClient({
  orderId,
  orderNo,
  orderTotalAmount,
  currency,
  locale,
  ui,
  reasonLabels,
}: {
  orderId: string;
  orderNo: string;
  orderTotalAmount: string;
  currency: string;
  locale: Locale;
  ui: WizardUi;
  reasonLabels: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState<ReturnableUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<OrderReturnReason>("DONT_WANT");
  const [details, setDetails] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setUnitsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/customer/orders/${encodeURIComponent(orderId)}/returnable-units`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(ui.wizardLoadUnitsError);
        const data = (await res.json()) as { units: ReturnableUnit[] };
        if (cancelled) return;
        setUnits(data.units);
        if (data.units.length === 1) {
          setSelectedUnitIds(new Set([data.units[0]!.id]));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : ui.wizardLoadUnitsError);
      } finally {
        if (!cancelled) setUnitsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, ui.wizardLoadUnitsError]);

  const steps = useMemo(
    () => [
      { key: "units", label: ui.wizardStepUnits },
      { key: "reason", label: ui.wizardStepReason },
      { key: "details", label: ui.wizardStepDetails },
      { key: "policy", label: ui.wizardStepPolicy },
    ],
    [ui.wizardStepDetails, ui.wizardStepPolicy, ui.wizardStepReason, ui.wizardStepUnits],
  );

  const selectedTotal = useMemo(() => {
    return units
      .filter((u) => selectedUnitIds.has(u.id))
      .reduce((sum, u) => sum + Number(u.lineTotal), 0);
  }, [selectedUnitIds, units]);

  function toggleUnit(id: string) {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function canAdvance(): boolean {
    if (step === 0) return selectedUnitIds.size > 0;
    if (step === 1) return Boolean(reason);
    if (step === 2) return details.trim().length > 0;
    if (step === 3) return policyAccepted;
    return false;
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/customer/returns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          unitIds: [...selectedUnitIds],
          reason,
          details: details.trim(),
          policyAccepted: true as const,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; id?: string } | null;
      if (!res.ok || !body?.id) {
        throw new Error(body?.error ?? ui.wizardSubmitError);
      }
      toast.success(toastDict.returnSubmitted);
      router.push(`/returns/${body.id}`);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.wizardSubmitError;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (unitsLoading) {
    return <p className="text-sm text-[var(--muted)]">{ui.wizardSubmitting}</p>;
  }

  return (
    <div className="space-y-6" dir={direction}>
      <p className="text-sm text-[var(--muted)]">
        <span className="font-mono text-[var(--foreground)]">{orderNo}</span>
        {" · "}
        <span className="font-medium">{formatMoney(orderTotalAmount, currency, locale)}</span>
      </p>

      <ol className="flex flex-wrap gap-2 text-xs font-medium text-[var(--muted)]">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={`rounded-full px-3 py-1 ${
              i === step
                ? "bg-[var(--foreground)] text-[var(--background)] "
                : "bg-[var(--table-head-bg)]"
            }`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {error ? <p className="app-alert-error">{error}</p> : null}

      {step === 0 ? (
        <section className="space-y-3">
          <p className="text-sm font-medium text-[var(--foreground)]">{ui.wizardSelectUnits}</p>
          <p className="text-xs text-[var(--muted)]">{ui.wizardSelectUnitsHint}</p>
          <div className="space-y-2">
            {units.map((unit) => (
              <label
                key={unit.id}
                className="flex cursor-pointer gap-3 rounded-lg border border-[var(--border)] p-3 dark:border-[var(--border-strong)]"
              >
                <input
                  type="checkbox"
                  checked={selectedUnitIds.has(unit.id)}
                  onChange={() => toggleUnit(unit.id)}
                  className="mt-1"
                />
                <span className="text-sm text-[var(--foreground)]">
                  <span className="font-medium">{unit.productName}</span>
                  {unit.unitLabel ? (
                    <span className="mt-0.5 block font-mono text-xs text-[var(--muted)]">
                      {ui.wizardUnitLabel.replace("{label}", unit.unitLabel)}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block tabular-nums text-[var(--muted)]">
                    {formatMoney(unit.lineTotal, currency, locale)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {selectedUnitIds.size > 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {ui.wizardSelectUnits}: {selectedUnitIds.size} ·{" "}
              {formatMoney(String(selectedTotal), currency, locale)}
            </p>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-3">
          <p className="text-sm text-[var(--foreground)]">{ui.wizardSelectReason}</p>
          <div className="space-y-2">
            {REASON_ORDER.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer gap-3 rounded-lg border border-[var(--border)] p-3 dark:border-[var(--border-strong)]"
              >
                <input
                  type="radio"
                  name="reason"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="mt-1"
                />
                <span className="text-sm text-[var(--foreground)]">{reasonLabels[r] ?? r}</span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-2">
          <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="return-details">
            {ui.wizardStepDetails}
          </label>
          <p className="text-xs text-[var(--muted)]">{ui.wizardDetailsHint}</p>
          <textarea
            id="return-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={6}
            maxLength={4000}
            className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-sm dark:bg-[var(--surface)]"
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <p className="text-sm text-[var(--foreground)]">{ui.wizardPolicyIntro}</p>
          <label className="flex cursor-pointer gap-3 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={policyAccepted}
              onChange={(e) => setPolicyAccepted(e.target.checked)}
            />
            {ui.wizardPolicyCheckbox}
          </label>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <button
            type="button"
            className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--table-head-bg)]"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={submitting}
          >
            {ui.wizardBack}
          </button>
        ) : null}
        {step < 3 ? (
          <button
            type="button"
            className="btn-neutral rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={!canAdvance() || submitting}
            onClick={() => setStep((s) => Math.min(3, s + 1))}
          >
            {ui.wizardNext}
          </button>
        ) : (
          <button
            type="button"
            className="btn-neutral rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={!canAdvance() || submitting}
            onClick={() => void submit()}
          >
            {submitting ? ui.wizardSubmitting : ui.wizardSubmit}
          </button>
        )}
      </div>
    </div>
  );
}
