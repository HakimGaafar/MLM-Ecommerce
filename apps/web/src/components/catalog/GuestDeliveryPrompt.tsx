"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ADDRESS_CITIES, type AddressCountryCode } from "@mlm/shared";

type Ui = {
  promptTitle: string;
  promptBody: string;
  country: string;
  city: string;
  cityOther: string;
  save: string;
  saving: string;
  change: string;
  showingFor: string;
  countrySA: string;
  countryOM: string;
  countryEG: string;
  error: string;
};

export default function GuestDeliveryPrompt({
  locale,
  ui,
  needsPrompt,
  delivery,
  defaultCountryCode,
}: {
  locale: "en" | "ar";
  ui: Ui;
  needsPrompt: boolean;
  delivery: { countryCode: string; city: string } | null;
  defaultCountryCode: AddressCountryCode;
}) {
  const router = useRouter();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [countryCode, setCountryCode] = useState<AddressCountryCode>(defaultCountryCode);
  const [city, setCity] = useState("");
  const [cityCustom, setCityCustom] = useState("");
  const [editing, setEditing] = useState(needsPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cities = useMemo(() => ADDRESS_CITIES[countryCode] ?? [], [countryCode]);
  const resolvedCity = city === "__other__" ? cityCustom.trim() : city.trim();

  async function saveDelivery(event: FormEvent) {
    event.preventDefault();
    if (!resolvedCity) {
      setError(ui.error);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/public/guest-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, city: resolvedCity }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.error);
      setEditing(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ui.error);
    } finally {
      setLoading(false);
    }
  }

  if (!needsPrompt && !editing && delivery) {
    return (
      <div
        dir={direction}
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] px-4 py-3 text-sm"
      >
        <p className="text-[var(--foreground)]">
          {ui.showingFor.replace("{city}", delivery.city).replace("{country}", delivery.countryCode)}
        </p>
        <button
          type="button"
          className="btn-secondary btn-press rounded-lg px-3 py-1.5 text-xs font-medium"
          onClick={() => setEditing(true)}
        >
          {ui.change}
        </button>
      </div>
    );
  }

  if (!needsPrompt && !editing) return null;

  return (
    <section
      dir={direction}
      className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 sm:px-5 sm:py-5"
    >
      <h2 className="text-base font-semibold text-amber-100">{ui.promptTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-amber-50/90">{ui.promptBody}</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={saveDelivery}>
        <label className="block text-sm sm:col-span-1">
          <span className="text-amber-100/90">{ui.country}</span>
          <select
            className="app-input mt-1 w-full"
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value as AddressCountryCode);
              setCity("");
              setCityCustom("");
            }}
          >
            <option value="SA">{ui.countrySA}</option>
            <option value="OM">{ui.countryOM}</option>
            <option value="EG">{ui.countryEG}</option>
          </select>
        </label>
        <label className="block text-sm sm:col-span-1">
          <span className="text-amber-100/90">{ui.city}</span>
          <select
            className="app-input mt-1 w-full"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              if (e.target.value !== "__other__") setCityCustom("");
            }}
            required
          >
            <option value="">—</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__other__">{ui.cityOther}</option>
          </select>
        </label>
        {city === "__other__" ? (
          <label className="block text-sm sm:col-span-2">
            <span className="text-amber-100/90">{ui.city}</span>
            <input
              className="app-input mt-1 w-full"
              value={cityCustom}
              onChange={(e) => setCityCustom(e.target.value)}
              required
            />
          </label>
        ) : null}
        {error ? <p className="sm:col-span-2 text-sm text-red-300">{error}</p> : null}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {!needsPrompt ? (
            <button
              type="button"
              className="btn-secondary rounded-lg px-4 py-2 text-sm"
              onClick={() => setEditing(false)}
            >
              {ui.change}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? ui.saving : ui.save}
          </button>
        </div>
      </form>
    </section>
  );
}
