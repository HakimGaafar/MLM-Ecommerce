"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type AgreementNotice = {
  title: string;
  intro?: string;
  body?: string;
  point1?: string;
  point2?: string;
  point3?: string;
  point4?: string;
  platformClause: string;
  agreement: string;
};

type RecordUi = {
  title: string;
  accepted: string;
  pending: string;
  acceptedAt: string;
  version: string;
  viewAgreement: string;
  close: string;
  pendingHint: string;
};

export default function InternationalAgreementRecord({
  accepted,
  acceptedAt,
  version,
  locale,
  notice,
  ui,
  acceptHref,
}: {
  accepted: boolean;
  acceptedAt: Date | null;
  version: string | null;
  locale: "en" | "ar";
  notice: AgreementNotice;
  ui: RecordUi;
  acceptHref: string;
}) {
  const [agreementOpen, setAgreementOpen] = useState(false);
  const formattedDate = acceptedAt
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(acceptedAt)
    : null;

  const points = [notice.point1, notice.point2, notice.point3, notice.point4].filter(
    (point): point is string => Boolean(point),
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{ui.title}</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            accepted
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          }`}
        >
          {accepted ? ui.accepted : ui.pending}
        </span>
      </div>

      {accepted ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-(--muted)">{ui.acceptedAt}</dt>
            <dd className="mt-1 font-medium">{formattedDate}</dd>
          </div>
          <div>
            <dt className="text-(--muted)">{ui.version}</dt>
            <dd className="mt-1 font-mono font-medium">{version ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-(--muted)">
          {ui.pendingHint}{" "}
          <a href={acceptHref} className="font-medium text-link underline-offset-2 hover:underline">
            {notice.title}
          </a>
        </p>
      )}

      <button
        type="button"
        className="mt-5 flex w-full items-center gap-2 rounded-lg border border-border p-4 text-start text-sm font-semibold transition hover:bg-black/3 dark:hover:bg-white/5"
        onClick={() => setAgreementOpen(true)}
      >
        <span aria-hidden>▶</span>
        {ui.viewAgreement}
      </button>

      {agreementOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-9999 grid min-h-dvh place-items-center overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-[2px] sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="international-agreement-title"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setAgreementOpen(false);
              }}
            >
              <section
                className="relative my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] shadow-[0_24px_80px_rgba(0,0,0,0.35)] ring-1 ring-black/5 dark:border-white/10 dark:ring-white/5"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="h-1.5 bg-linear-to-r from-violet-500 via-indigo-500 to-sky-400" />
                <div className="p-5 sm:p-7">
                  <div className="flex items-start gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-violet-500/20 to-sky-400/20 text-primary ring-1 ring-primary/20">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden
                      >
                        <path d="M6 3h9l3 3v15H6z" />
                        <path d="M15 3v4h4M9 12h6M9 16h6" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="international-agreement-title"
                        className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
                      >
                        {notice.title}
                      </h2>
                      <p className="mt-1.5 text-sm text-(--muted)">
                        {ui.version}: <span className="font-mono">{version ?? "—"}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAgreementOpen(false)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-(--muted) transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                      aria-label={ui.close}
                    >
                      <span aria-hidden className="text-xl leading-none">×</span>
                    </button>
                  </div>

                  <div className="mt-6 max-h-[60vh] space-y-4 overflow-y-auto rounded-2xl border border-border/80 bg-black/1.5 p-5 text-sm leading-7 text-(--muted) dark:bg-white/2.5">
                    {notice.intro || notice.body ? <p>{notice.intro ?? notice.body}</p> : null}
                    {points.length > 0 ? (
                      <ul className="list-inside list-disc space-y-1">
                        {points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="font-medium text-foreground">{notice.platformClause}</p>
                    <p>{notice.agreement}</p>
                  </div>

                  <div className="mt-7 flex justify-end border-t border-border/70 pt-5">
                    <button
                      type="button"
                      className="btn-primary btn-press justify-center sm:min-w-32"
                      onClick={() => setAgreementOpen(false)}
                    >
                      {ui.close}
                    </button>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
