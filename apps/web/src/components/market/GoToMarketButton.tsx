"use client";

import { useState } from "react";
import type { MarketCode } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";

export default function GoToMarketButton({
  homeMarketCode,
  returnTo,
  label,
  switchError,
}: {
  homeMarketCode: MarketCode;
  returnTo: string;
  label: string;
  switchError: string;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function onSwitch() {
    if (saving) return;
    setSaving(true);
    try {
      const safePath =
        returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
      const url = `/api/v1/market/switch?returnTo=${encodeURIComponent(safePath)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketCode: homeMarketCode }),
      });
      const data = (await res.json().catch(() => null)) as {
        redirectUrl?: string;
      } | null;
      if (!res.ok || !data?.redirectUrl) {
        toast.error(switchError);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      toast.error(switchError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      className="btn-primary btn-press inline-flex"
      disabled={saving}
      onClick={() => void onSwitch()}
    >
      {saving ? "…" : label}
    </button>
  );
}
