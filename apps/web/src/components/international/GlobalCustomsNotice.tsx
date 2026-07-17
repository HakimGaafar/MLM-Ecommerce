"use client";

import { useEffect, useState } from "react";

export type GlobalCustomsNoticeUi = {
  title: string;
  body: string;
  points: string[];
  continueShopping: string;
  saveError: string;
};

const LEGACY_NOTICE_PREFIX = "fources:global-customs-notice";

function clearLegacyNoticeKeys() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_NOTICE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // ignore storage access errors
  }
}

export default function GlobalCustomsNotice({
  enabled,
  ui,
}: {
  enabled: boolean;
  ui: GlobalCustomsNoticeUi;
}) {
  const [open, setOpen] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearLegacyNoticeKeys();
  }, []);

  if (!enabled || !open) return null;

  async function continueShopping() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/customer/international-notice", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(ui.saveError);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ui.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-customs-notice-title"
    >
      <section className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-2xl sm:p-8">
        <h2 id="global-customs-notice-title" className="text-xl font-semibold">
          {ui.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-(--muted)">{ui.body}</p>
        <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-(--muted)">
          {ui.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        {error ? <p className="mt-4 app-alert-error">{error}</p> : null}
        <button
          type="button"
          disabled={saving}
          className="btn-primary mt-6 w-full disabled:opacity-60 sm:w-auto"
          onClick={() => void continueShopping()}
        >
          {saving ? "…" : ui.continueShopping}
        </button>
      </section>
    </div>
  );
}
