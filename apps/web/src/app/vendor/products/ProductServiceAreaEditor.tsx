"use client";

import { useMemo, useState } from "react";
import { ADDRESS_CITIES, type AddressCountryCode } from "@mlm/shared";

export type ServiceCityDraft = { countryCode: string; city: string };

type Labels = {
  title: string;
  hint: string;
  modeAll: string;
  modeSpecific: string;
  country: string;
  city: string;
  cityPlaceholder: string;
  addCity: string;
  removeCity: string;
  countrySA: string;
  countryOM: string;
  countryEG: string;
};

export default function ProductServiceAreaEditor({
  mode,
  cities,
  onModeChange,
  onCitiesChange,
  labels,
}: {
  mode: "ALL" | "SPECIFIC";
  cities: ServiceCityDraft[];
  onModeChange: (mode: "ALL" | "SPECIFIC") => void;
  onCitiesChange: (cities: ServiceCityDraft[]) => void;
  labels: Labels;
}) {
  const [countryCode, setCountryCode] = useState<AddressCountryCode>("SA");
  const [city, setCity] = useState("");

  const cityOptions = useMemo(() => ADDRESS_CITIES[countryCode] ?? [], [countryCode]);

  function addCity() {
    const resolvedCity = city.trim();
    if (!resolvedCity) return;
    const key = `${countryCode}:${resolvedCity.toLowerCase()}`;
    if (cities.some((c) => `${c.countryCode}:${c.city.toLowerCase()}` === key)) return;
    onCitiesChange([...cities, { countryCode, city: resolvedCity }]);
    setCity("");
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_4%,var(--surface))] p-4">
      <div>
        <h2 className="text-sm font-semibold">{labels.title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{labels.hint}</p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="serviceAreaMode"
            checked={mode === "ALL"}
            onChange={() => onModeChange("ALL")}
          />
          {labels.modeAll}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="serviceAreaMode"
            checked={mode === "SPECIFIC"}
            onChange={() => onModeChange("SPECIFIC")}
          />
          {labels.modeSpecific}
        </label>
      </div>

      {mode === "SPECIFIC" ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{labels.country}</span>
              <select
                className="app-input"
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value as AddressCountryCode);
                  setCity("");
                }}
              >
                <option value="SA">{labels.countrySA}</option>
                <option value="OM">{labels.countryOM}</option>
                <option value="EG">{labels.countryEG}</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{labels.city}</span>
              <select
                className="app-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">{labels.cityPlaceholder}</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" className="btn-secondary rounded-lg px-3 py-1.5 text-xs" onClick={addCity}>
            {labels.addCity}
          </button>
          {cities.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {cities.map((c) => (
                <li
                  key={`${c.countryCode}:${c.city}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs"
                >
                  {c.city}, {c.countryCode}
                  <button
                    type="button"
                    className="text-red-600 hover:underline dark:text-red-400"
                    onClick={() =>
                      onCitiesChange(
                        cities.filter(
                          (row) =>
                            !(
                              row.countryCode === c.countryCode &&
                              row.city.toLowerCase() === c.city.toLowerCase()
                            ),
                        ),
                      )
                    }
                  >
                    {labels.removeCity}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
