"use client";

import { useState } from "react";

type Notice = {
  title: string;
  intro: string;
  point1: string;
  point2: string;
  point3: string;
  point4: string;
  platformClause: string;
  agreement: string;
  accept: string;
  saving: string;
  error: string;
  ownerOnly: string;
  dismiss: string;
};

export default function VendorInternationalConsentBanner({
  notice,
  canAccept,
}: {
  notice: Notice | null;
  canAccept: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!notice || dismissed || accepted) return null;

  async function accept() {
    if (!checked || saving || !canAccept) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/vendor/international-consent", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(notice!.error);
      setAccepted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : notice!.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-b border-amber-400/40 bg-amber-400/10 px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{notice.title}</h2>
            <p className="mt-2 text-sm leading-6 text-(--muted)">{notice.intro}</p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-(--muted)">
              <li>{notice.point1}</li>
              <li>{notice.point2}</li>
              <li>{notice.point3}</li>
              <li>{notice.point4}</li>
            </ul>
            <p className="mt-3 text-sm font-medium">{notice.platformClause}</p>
          </div>
          <button
            type="button"
            className="text-sm text-(--muted) underline"
            onClick={() => setDismissed(true)}
          >
            {notice.dismiss}
          </button>
        </div>
        {canAccept ? (
          <>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
              />
              <span>{notice.agreement}</span>
            </label>
            {error ? <p className="mt-3 app-alert-error">{error}</p> : null}
            <button
              type="button"
              className="btn-primary mt-4"
              disabled={!checked || saving}
              onClick={() => void accept()}
            >
              {saving ? notice.saving : notice.accept}
            </button>
          </>
        ) : (
          <p className="mt-4 text-sm text-(--muted)">{notice.ownerOnly}</p>
        )}
      </div>
    </section>
  );
}
