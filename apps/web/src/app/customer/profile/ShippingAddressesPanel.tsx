"use client";

import type { CustomerShippingAddressDto } from "@mlm/shared";
import {
  ADDRESS_CITIES,
  ADDRESS_GOVERNORATES,
  isAddressCountryCode,
  isAddressFieldRequired,
  isValidSaShortNationalAddress,
  normalizeSaShortNationalAddress,
  type AddressCountryCode,
} from "@mlm/shared";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type Ui = {
  sectionTitle: string;
  sectionHint: string;
  loading: string;
  loadError: string;
  empty: string;
  defaultBadge: string;
  recipient: string;
  phone: string;
  countryCode: string;
  countrySA: string;
  countryOM: string;
  countryEG: string;
  governorate: string;
  city: string;
  stateLabel: string;
  cityOther: string;
  neighborhood: string;
  building: string;
  postalCode: string;
  line1: string;
  line2: string;
  fullAddress: string;
  shortNationalAddress: string;
  shortNationalAddressHint: string;
  shortNationalAddressInvalid: string;
  mapPin: string;
  mapPinHint: string;
  latitude: string;
  longitude: string;
  openMap: string;
  labelOptional: string;
  setDefault: string;
  delete: string;
  edit: string;
  save: string;
  cancel: string;
  addButton: string;
  addTitle: string;
  deleteConfirm: string;
};

type AddressFormState = {
  label: string;
  recipientName: string;
  phone: string;
  countryCode: AddressCountryCode;
  governorate: string;
  city: string;
  cityCustom: string;
  neighborhood: string;
  building: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
  fullAddress: string;
  shortNationalAddress: string;
  latitude: string;
  longitude: string;
};

const emptyForm: AddressFormState = {
  label: "",
  recipientName: "",
  phone: "",
  countryCode: "SA",
  governorate: "",
  city: "",
  cityCustom: "",
  neighborhood: "",
  building: "",
  postalCode: "",
  addressLine1: "",
  addressLine2: "",
  fullAddress: "",
  shortNationalAddress: "",
  latitude: "",
  longitude: "",
};

const inputClass =
  "mt-1 w-full rounded border border-[var(--border-strong)] px-2 py-1.5 dark:bg-[var(--surface)]";

const AddressMapPicker = dynamic(() => import("@/components/address/AddressMapPicker"), {
  ssr: false,
  loading: () => <div className="mt-3 h-56 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />,
});

function resolveCity(form: AddressFormState): string {
  return form.city === "__other__" ? form.cityCustom.trim() : form.city.trim();
}

function formToPayload(form: AddressFormState) {
  const lat = form.latitude.trim() ? Number(form.latitude) : undefined;
  const lng = form.longitude.trim() ? Number(form.longitude) : undefined;
  return {
    label: form.label.trim() || undefined,
    recipientName: form.recipientName.trim(),
    phone: form.phone.trim(),
    countryCode: form.countryCode,
    governorate: form.governorate.trim() || undefined,
    city: resolveCity(form),
    neighborhood: form.neighborhood.trim() || undefined,
    building: form.building.trim() || undefined,
    postalCode: form.postalCode.trim(),
    addressLine1: form.addressLine1.trim() || form.neighborhood.trim() || resolveCity(form) || "—",
    addressLine2: form.addressLine2.trim() || undefined,
    fullAddress: form.fullAddress.trim() || undefined,
    shortNationalAddress: form.shortNationalAddress.trim() || undefined,
    latitude: lat != null && !Number.isNaN(lat) ? lat : undefined,
    longitude: lng != null && !Number.isNaN(lng) ? lng : undefined,
  };
}

function rowToForm(row: CustomerShippingAddressDto): AddressFormState {
  const cc = isAddressCountryCode(row.countryCode) ? row.countryCode : "SA";
  const cities = ADDRESS_CITIES[cc];
  const cityKnown = cities.includes(row.city);
  return {
    label: row.label ?? "",
    recipientName: row.recipientName,
    phone: row.phone,
    countryCode: cc,
    governorate: row.governorate ?? "",
    city: cityKnown ? row.city : "__other__",
    cityCustom: cityKnown ? "" : row.city,
    neighborhood: row.neighborhood ?? "",
    building: row.building ?? "",
    postalCode: row.postalCode,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2 ?? "",
    fullAddress: row.fullAddress ?? "",
    shortNationalAddress: row.shortNationalAddress ?? "",
    latitude: row.latitude != null ? String(row.latitude) : "",
    longitude: row.longitude != null ? String(row.longitude) : "",
  };
}

export default function ShippingAddressesPanel({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [items, setItems] = useState<CustomerShippingAddressDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddressFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/customer/shipping-addresses?page=${page}&pageSize=${pageSize}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { items: CustomerShippingAddressDto[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSetDefault(id: string) {
    setError(null);
    const res = await fetch(`/api/v1/customer/shipping-addresses/${encodeURIComponent(id)}/default`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const p = (await res.json().catch(() => null)) as { error?: string } | null;
      const msg = p?.error ?? ui.loadError;
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success(toastDict.defaultAddressSet);
    await load();
  }

  async function onDelete(id: string) {
    if (!window.confirm(ui.deleteConfirm)) return;
    setError(null);
    const res = await fetch(`/api/v1/customer/shipping-addresses/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const p = (await res.json().catch(() => null)) as { error?: string } | null;
      const msg = p?.error ?? ui.loadError;
      setError(msg);
      toast.error(msg);
      return;
    }
    setEditingId(null);
    toast.success(toastDict.addressDeleted);
    await load();
  }

  function startEdit(row: CustomerShippingAddressDto) {
    setShowAdd(false);
    setEditingId(row.id);
    setForm(rowToForm(row));
  }

  async function submitForm(forEditId: string | null) {
    setError(null);
    if (
      form.countryCode === "SA" &&
      form.shortNationalAddress.trim() &&
      !isValidSaShortNationalAddress(normalizeSaShortNationalAddress(form.shortNationalAddress))
    ) {
      setError(ui.shortNationalAddressInvalid);
      return;
    }
    setSaving(true);
    try {
      const body = formToPayload(form);
      if (forEditId) {
        const res = await fetch(`/api/v1/customer/shipping-addresses/${encodeURIComponent(forEditId)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const p = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(p?.error ?? ui.loadError);
        }
        setEditingId(null);
      } else {
        const res = await fetch("/api/v1/customer/shipping-addresses", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const p = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(p?.error ?? ui.loadError);
        }
        setShowAdd(false);
      }
      setForm(emptyForm);
      toast.success(toastDict.addressSaved);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  return (
    <section className="mt-10 border-t border-[var(--border)] pt-8" dir={direction}>
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{ui.sectionTitle}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{ui.sectionHint}</p>

      {error ? <p className="mt-3 app-alert-error">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
        ) : (
          items.map((row) => (
            <div key={row.id} className="rounded-lg border border-[var(--border)] p-4 dark:border-[var(--border-strong)]">
              {editingId === row.id ? (
                <AddressFormFields form={form} setForm={setForm} ui={ui} />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--foreground)]">
                      {row.recipientName}
                      {row.label ? <span className="text-[var(--muted)]"> · {row.label}</span> : null}
                      {row.isDefault ? (
                        <span className="ms-2 rounded-full bg-[color-mix(in_srgb,var(--foreground)_12%,var(--surface))] px-2 py-0.5 text-xs dark:bg-[color-mix(in_srgb,var(--foreground)_18%,var(--surface))]">
                          {ui.defaultBadge}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{row.phone}</p>
                    <p className="mt-1 text-sm text-[var(--foreground)]">
                      {[row.neighborhood, row.addressLine1, row.building].filter(Boolean).join(", ")}
                      <br />
                      {[row.governorate, row.city, row.postalCode, row.countryCode].filter(Boolean).join(", ")}
                      {row.shortNationalAddress ? (
                        <>
                          <br />
                          {row.shortNationalAddress}
                        </>
                      ) : null}
                      {row.latitude != null && row.longitude != null ? (
                        <>
                          <br />
                          <a
                            className="text-link"
                            href={`https://www.openstreetmap.org/?mlat=${row.latitude}&mlon=${row.longitude}#map=16/${row.latitude}/${row.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {ui.openMap}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!row.isDefault ? (
                      <button
                        type="button"
                        className="text-sm font-medium text-[var(--primary)]"
                        onClick={() => void onSetDefault(row.id)}
                      >
                        {ui.setDefault}
                      </button>
                    ) : null}
                    <button type="button" className="text-sm font-medium text-[var(--primary)]" onClick={() => startEdit(row)}>
                      {ui.edit}
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-red-600 dark:text-red-400"
                      onClick={() => void onDelete(row.id)}
                    >
                      {ui.delete}
                    </button>
                  </div>
                </div>
              )}
              {editingId === row.id ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    className="btn-neutral rounded-lg px-3 py-1.5 text-sm"
                    onClick={() => void submitForm(row.id)}
                  >
                    {saving ? "…" : ui.save}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-sm"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                  >
                    {ui.cancel}
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {showAdd ? (
        <div className="mt-6 rounded-lg border border-[var(--border)] p-4 dark:border-[var(--border-strong)]">
          <h3 className="text-sm font-semibold">{ui.addTitle}</h3>
          <AddressFormFields form={form} setForm={setForm} ui={ui} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              className="btn-neutral rounded-lg px-3 py-1.5 text-sm"
              onClick={() => void submitForm(null)}
            >
              {saving ? "…" : ui.save}
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-sm"
              onClick={() => {
                setShowAdd(false);
                setForm(emptyForm);
              }}
            >
              {ui.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-4 text-sm font-medium text-link"
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
            setShowAdd(true);
          }}
        >
          {ui.addButton}
        </button>
      )}
      {items.length > 0 ? (
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          labels={getPaginationLabels(locale)}
          className="mt-4"
        />
      ) : null}
    </section>
  );
}

function AddressFormFields({
  form,
  setForm,
  ui,
}: {
  form: AddressFormState;
  setForm: Dispatch<SetStateAction<AddressFormState>>;
  ui: Ui;
}) {
  const cc = form.countryCode;
  const cities = ADDRESS_CITIES[cc];
  const governorates = cc === "OM" || cc === "EG" ? ADDRESS_GOVERNORATES[cc] : [];
  const showStreet = cc === "SA" || cc === "EG";
  const showBuilding = cc === "EG";
  const showGovernorate = cc === "OM" || cc === "EG";
  const showShortNational = cc === "SA";
  const cityLabel = cc === "OM" ? ui.stateLabel : ui.city;
  const requires = (field: Parameters<typeof isAddressFieldRequired>[1]) =>
    isAddressFieldRequired(cc, field);

  const handleMapChange = useCallback(
    (lat: string, lng: string) => {
      setForm((current) => ({ ...current, latitude: lat, longitude: lng }));
    },
    [setForm],
  );

  const commitMapCoordsFromFields = useCallback(() => {
    setForm((current) => {
      const lat = Number(current.latitude.trim());
      const lng = Number(current.longitude.trim());
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return current;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return current;
      const latitude = lat.toFixed(6);
      const longitude = lng.toFixed(6);
      if (latitude === current.latitude && longitude === current.longitude) return current;
      return { ...current, latitude, longitude };
    });
  }, [setForm]);

  const mapHref = useMemo(() => {
    const q = encodeURIComponent(
      [form.neighborhood, resolveCity(form), form.governorate, form.countryCode].filter(Boolean).join(", "),
    );
    if (form.latitude.trim() && form.longitude.trim()) {
      return `https://www.openstreetmap.org/?mlat=${form.latitude.trim()}&mlon=${form.longitude.trim()}#map=16/${form.latitude.trim()}/${form.longitude.trim()}`;
    }
    return `https://www.openstreetmap.org/search?query=${q}`;
  }, [form]);

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2">
        <span className="text-[var(--muted)]">{ui.labelOptional}</span>
        <input className={inputClass} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{ui.recipient}</span>
        <input
          className={inputClass}
          value={form.recipientName}
          onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{ui.phone}</span>
        <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{ui.countryCode}</span>
        <select
          className={inputClass}
          value={form.countryCode}
          onChange={(e) => {
            const next = e.target.value as AddressCountryCode;
            setForm({
              ...form,
              countryCode: next,
              governorate: "",
              city: "",
              cityCustom: "",
              latitude: "",
              longitude: "",
            });
          }}
        >
          <option value="SA">{ui.countrySA}</option>
          <option value="OM">{ui.countryOM}</option>
          <option value="EG">{ui.countryEG}</option>
        </select>
      </label>
      {showGovernorate ? (
        <label className="block text-sm">
          <span className="text-[var(--muted)]">{ui.governorate}</span>
          <select
            className={inputClass}
            value={form.governorate}
            onChange={(e) => setForm({ ...form, governorate: e.target.value })}
            required={requires("governorate")}
          >
            <option value="">—</option>
            {governorates.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{cityLabel}</span>
        <select
          className={inputClass}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value, cityCustom: e.target.value === "__other__" ? form.cityCustom : "" })}
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
      {form.city === "__other__" ? (
        <label className="block text-sm">
          <span className="text-[var(--muted)]">{cityLabel}</span>
          <input
            className={inputClass}
            value={form.cityCustom}
            onChange={(e) => setForm({ ...form, cityCustom: e.target.value })}
            required
          />
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{ui.neighborhood}</span>
        <input
          className={inputClass}
          value={form.neighborhood}
          onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
          required={requires("neighborhood")}
        />
      </label>
      {showBuilding ? (
        <label className="block text-sm">
          <span className="text-[var(--muted)]">{ui.building}</span>
          <input
            className={inputClass}
            value={form.building}
            onChange={(e) => setForm({ ...form, building: e.target.value })}
            required={requires("building")}
          />
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{ui.postalCode}</span>
        <input
          className={inputClass}
          value={form.postalCode}
          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          required={requires("postalCode")}
        />
      </label>
      {showStreet ? (
        <label className="block text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">{ui.line1}</span>
          <input
            className={inputClass}
            value={form.addressLine1}
            onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
            required={requires("street")}
          />
        </label>
      ) : null}
      {showShortNational ? (
        <label className="block text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">{ui.shortNationalAddress}</span>
          <input
            className={inputClass}
            value={form.shortNationalAddress}
            onChange={(e) => setForm({ ...form, shortNationalAddress: e.target.value.toUpperCase() })}
            placeholder={ui.shortNationalAddressHint}
            maxLength={8}
            dir="ltr"
          />
        </label>
      ) : null}
      <label className="block text-sm sm:col-span-2">
        <span className="text-[var(--muted)]">{ui.fullAddress}</span>
        <input
          className={inputClass}
          value={form.fullAddress}
          onChange={(e) => setForm({ ...form, fullAddress: e.target.value })}
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="text-[var(--muted)]">{ui.line2}</span>
        <input
          className={inputClass}
          value={form.addressLine2}
          onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
        />
      </label>

      <div className="sm:col-span-2 rounded-lg border border-dashed border-[var(--border)] p-3">
        <p className="text-sm font-medium text-[var(--foreground)]">{ui.mapPin}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{ui.mapPinHint}</p>
        <AddressMapPicker
          countryCode={cc}
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={handleMapChange}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.latitude}</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              onBlur={commitMapCoordsFromFields}
              placeholder="24.7136"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.longitude}</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              onBlur={commitMapCoordsFromFields}
              placeholder="46.6753"
            />
          </label>
        </div>
        <a className="mt-3 inline-block text-sm text-link" href={mapHref} target="_blank" rel="noopener noreferrer">
          {ui.openMap}
        </a>
      </div>
    </div>
  );
}
