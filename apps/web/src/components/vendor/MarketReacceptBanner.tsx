"use client";

import { useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type Copy = {
  title: string;
  body: string;
  accept: string;
  accepting: string;
  error: string;
  success: string;
};

export default function MarketReacceptBanner({
  marketCode,
  copy,
  onAccepted,
}: {
  marketCode: string;
  copy: Copy;
  onAccepted?: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/vendor/market-reaccept", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? copy.error);
      toast.success(copy.success);
      onAccepted?.();
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-5 text-sm">
      <h2 className="text-base font-semibold text-[var(--foreground)]">{copy.title}</h2>
      <p className="mt-2 leading-6 text-[var(--muted)]">
        {copy.body.replace("{market}", marketCode)}
      </p>
      <div className="mt-4">
        <button
          type="button"
          className="btn-primary btn-press text-sm disabled:opacity-50"
          disabled={busy}
          onClick={() => void accept()}
        >
          {busy ? copy.accepting : copy.accept}
        </button>
      </div>
    </section>
  );
}
