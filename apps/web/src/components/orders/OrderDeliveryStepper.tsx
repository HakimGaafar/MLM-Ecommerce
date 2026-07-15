"use client";

import type { OrderDeliveryStepId, OrderDeliveryStepState } from "@/lib/order-delivery-steps";
import { buildOrderDeliverySteps } from "@/lib/order-delivery-steps";

type Locale = "en" | "ar";

type StepHints = Record<OrderDeliveryStepId, string>;

const dotStyles: Record<OrderDeliveryStepState, string> = {
  complete: "bg-emerald-600 text-white ring-emerald-600/20",
  current: "bg-[var(--primary)] text-[var(--primary-foreground)] ring-[color-mix(in_srgb,var(--primary)_30%,transparent)]",
  upcoming: "border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] ring-transparent",
  cancelled: "bg-red-600 text-white ring-red-600/20",
};

const labelStyles: Record<OrderDeliveryStepState, string> = {
  complete: "text-[var(--foreground)]",
  current: "font-semibold text-[var(--foreground)]",
  upcoming: "text-[var(--muted)]",
  cancelled: "font-semibold text-red-600 dark:text-red-400",
};

export default function OrderDeliveryStepper({
  customerStep,
  locale,
  title,
  stepLabels,
  stepHints,
  deliveredOn,
  deliveredOnLabel,
  cancelledMessage,
}: {
  customerStep: string;
  locale: Locale;
  title: string;
  stepLabels: Record<string, string>;
  stepHints: StepHints;
  deliveredOn?: string | null;
  deliveredOnLabel: string;
  cancelledMessage: string;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const steps = buildOrderDeliverySteps(customerStep);
  const isCancelled = customerStep === "CANCELLED";

  return (
    <section className="app-card p-6" dir={direction} aria-label={title}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h2>

      {isCancelled ? (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300">
          {cancelledMessage}
        </p>
      ) : null}

      <ol className="mt-5 grid gap-4 sm:grid-cols-4 sm:gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex flex-col items-center text-center sm:px-1">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ${dotStyles[step.state]}`}
              aria-hidden
            >
              {step.state === "complete" ? "✓" : index + 1}
            </span>
            <p className={`mt-2 text-xs sm:text-sm ${labelStyles[step.state]}`}>
              {stepLabels[step.id] ?? step.id}
            </p>
            <p className="mt-0.5 hidden text-[10px] text-[var(--muted)] sm:block">{stepHints[step.id]}</p>
          </li>
        ))}
      </ol>

      {deliveredOn && !isCancelled ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          {deliveredOnLabel}: {deliveredOn}
        </p>
      ) : null}
    </section>
  );
}
