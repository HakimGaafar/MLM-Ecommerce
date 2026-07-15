"use client";

import type { CustomerShippingAddressDto } from "@mlm/shared";
import { useCallback, useEffect, useState } from "react";
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
  city: string;
  postalCode: string;
  line1: string;
  line2: string;
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

const emptyForm = {
  label: "",
  recipientName: "",
  phone: "",
  countryCode: "SA",
  city: "",
  postalCode: "",
  addressLine1: "",
  addressLine2: "",
};

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
  const [form, setForm] = useState(emptyForm);
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
    setForm({
      label: row.label ?? "",
      recipientName: row.recipientName,
      phone: row.phone,
      countryCode: row.countryCode,
      city: row.city,
      postalCode: row.postalCode,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2 ?? "",
    });
  }

  async function submitForm(forEditId: string | null) {
    setError(null);
    setSaving(true);
    try {
      if (forEditId) {
        const res = await fetch(`/api/v1/customer/shipping-addresses/${encodeURIComponent(forEditId)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label.trim() || undefined,
            recipientName: form.recipientName.trim(),
            phone: form.phone.trim(),
            countryCode: form.countryCode.trim(),
            city: form.city.trim(),
            postalCode: form.postalCode.trim(),
            addressLine1: form.addressLine1.trim(),
            addressLine2: form.addressLine2.trim() || undefined,
          }),
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
          body: JSON.stringify({
            label: form.label.trim() || undefined,
            recipientName: form.recipientName.trim(),
            phone: form.phone.trim(),
            countryCode: form.countryCode.trim(),
            city: form.city.trim(),
            postalCode: form.postalCode.trim(),
            addressLine1: form.addressLine1.trim(),
            addressLine2: form.addressLine2.trim() || undefined,
          }),
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
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">
                        {row.recipientName}
                        {row.label ? <span className="text-[var(--muted)]"> · {row.label}</span> : null}
                        {row.isDefault ? (
                          <span className="ms-2 rounded-full bg-[color-mix(in_srgb,var(--foreground)_12%,var(--surface))] px-2 py-0.5 text-xs dark:bg-[color-mix(in_srgb,var(--foreground)_18%,var(--surface))]">{ui.defaultBadge}</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{row.phone}</p>
                      <p className="mt-1 text-sm text-[var(--foreground)]">
                        {row.addressLine1}
                        {row.addressLine2 ? `, ${row.addressLine2}` : ""}
                        <br />
                        {row.city}, {row.postalCode}, {row.countryCode}
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
                      <button
                        type="button"
                        className="text-sm font-medium text-[var(--primary)]"
                        onClick={() => startEdit(row)}
                      >
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
                </>
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
  form: typeof emptyForm;
  setForm: (v: typeof emptyForm) => void;
  ui: Ui;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2">
        <span className="text-[var(--muted)]">{ui.labelOptional}</span>
        <input
          className="mt-1 w-full rounded border border-[var(--border-strong)] px-2 py-1.5 dark:bg-[var(--surface)]"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{ui.recipient}</span>
        <input
          className="mt-1 w-full rounded border border-[var(--border-strong)] px-2 py-1.5 dark:bg-[var(--surface)]"
          value={form.recipientName}
          onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{ui.phone}</span>
        <input
          className="mt-1 w-full rounded border border-[var(--border-strong)] px-2 py-1.5 dark:bg-[var(--surface)]"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{ui.countryCode}</span>
        <input
          className="mt-1 w-full rounded border border-[var(--border-strong)] px-2 py-1.5 dark:bg-[var(--surface)]"
          maxLength={2}
          value={form.countryCode}
          onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{ui.city}</span>
        <input
          className="mt-1 w-full rounded border border-[var(--border-strong)] px-2 py-1.5 dark:bg-[var(--surface)]"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{ui.postalCode}</span>
        <input
          className="mt-1 w-full rounded border border-[var(--border-strong)] px-2 py-1.5 dark:bg-[var(--surface)]"
          value={form.postalCode}
          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="text-[var(--muted)]">{ui.line1}</span>
        <input
          className="mt-1 w-full rounded border border-[var(--border-strong)] px-2 py-1.5 dark:bg-[var(--surface)]"
          value={form.addressLine1}
          onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="text-[var(--muted)]">{ui.line2}</span>
        <input
          className="mt-1 w-full rounded border border-[var(--border-strong)] px-2 py-1.5 dark:bg-[var(--surface)]"
          value={form.addressLine2}
          onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
        />
      </label>
    </div>
  );
}
