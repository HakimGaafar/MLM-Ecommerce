"use client";

import type { ReturnRefundTimeline, ReturnTimelineStepId } from "@mlm/domain";

type Locale = "en" | "ar";

type StepLabels = Record<
  ReturnTimelineStepId,
  { title: string; description: string }
>;

const dotStyles: Record<
  ReturnRefundTimeline["steps"][number]["state"],
  string
> = {
  complete: "bg-emerald-600 text-white ring-emerald-600/20",
  current:
    "bg-[var(--primary)] text-[var(--primary-foreground)] ring-[color-mix(in_srgb,var(--primary)_30%,transparent)]",
  upcoming:
    "border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] ring-transparent",
  failed: "bg-red-600 text-white ring-red-600/20",
  cancelled:
    "border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] ring-transparent line-through",
};

const labelStyles: Record<
  ReturnRefundTimeline["steps"][number]["state"],
  string
> = {
  complete: "text-[var(--foreground)]",
  current: "font-semibold text-[var(--foreground)]",
  upcoming: "text-[var(--muted)]",
  failed: "font-semibold text-red-600 dark:text-red-400",
  cancelled: "text-[var(--muted)] line-through",
};

function stepIcon(
  state: ReturnRefundTimeline["steps"][number]["state"],
  index: number,
): string {
  if (state === "complete") return "✓";
  if (state === "failed") return "✗";
  if (state === "cancelled") return "—";
  return String(index + 1);
}

export default function ReturnRefundTimeline({
  timeline,
  locale,
  title,
  stepLabels,
  rejectedMessage,
  cancelledMessage,
}: {
  timeline: ReturnRefundTimeline;
  locale: Locale;
  title: string;
  stepLabels: StepLabels;
  rejectedMessage: string;
  cancelledMessage: string;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const hasFailed = timeline.steps.some((step) => step.state === "failed");
  const hasCancelled = timeline.steps.some((step) => step.state === "cancelled");

  return (
    <section className="app-card p-6" dir={direction} aria-label={title}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h2>

      {hasFailed ? (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300">
          {rejectedMessage}
        </p>
      ) : null}

      {hasCancelled ? (
        <p className="mt-3 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--foreground)_4%,var(--surface))] px-4 py-3 text-sm font-medium text-[var(--muted)]">
          {cancelledMessage}
        </p>
      ) : null}

      <ol className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-2">
        {timeline.steps.map((step, index) => {
          const label = stepLabels[step.id];
          return (
            <li key={step.id} className="flex flex-col items-center text-center sm:px-1">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ${dotStyles[step.state]}`}
                aria-hidden
              >
                {stepIcon(step.state, index)}
              </span>
              <p className={`mt-2 text-xs sm:text-sm ${labelStyles[step.state]}`}>
                {label.title}
              </p>
              <p className="mt-0.5 hidden text-[10px] leading-snug text-[var(--muted)] sm:block">
                {label.description}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
