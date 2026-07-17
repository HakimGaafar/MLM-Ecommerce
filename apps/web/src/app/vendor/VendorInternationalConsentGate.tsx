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
};

export default function VendorInternationalConsentGate({
  notice,
  canAccept,
  children,
}: {
  notice: Notice | null;
  canAccept: boolean;
  children: React.ReactNode;
}) {
  const [accepted, setAccepted] = useState(notice === null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (accepted) return children;

  async function accept() {
    if (!checked || saving) return;
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
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <section className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-6">
        <h1 className="text-xl font-semibold">{notice!.title}</h1>
        <p className="mt-3 text-sm leading-7 text-(--muted)">{notice!.intro}</p>
        <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-(--muted)">
          <li>{notice!.point1}</li>
          <li>{notice!.point2}</li>
          <li>{notice!.point3}</li>
          <li>{notice!.point4}</li>
        </ul>
        <p className="mt-4 text-sm font-medium">{notice!.platformClause}</p>
        {canAccept ? (
          <>
            <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
              />
              <span>{notice!.agreement}</span>
            </label>
            {error ? <p className="mt-3 app-alert-error">{error}</p> : null}
            <button
              type="button"
              className="btn-primary mt-5"
              disabled={!checked || saving}
              onClick={() => void accept()}
            >
              {saving ? notice!.saving : notice!.accept}
            </button>
          </>
        ) : (
          <p className="mt-5 app-alert-error">{notice!.ownerOnly}</p>
        )}
      </section>
    </main>
  );
}
