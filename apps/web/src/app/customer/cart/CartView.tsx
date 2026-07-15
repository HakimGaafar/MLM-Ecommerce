"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type CartLine = {
  itemId: string;
  productId: string;
  name: string;
  vendorName: string;
  unitPrice: string;
  currency: string;
  quantity: number;
  lineTotal: string;
};

type CartPayload = {
  items: CartLine[];
  subtotal: string;
  currency: string;
};

type CartUi = {
  loading: string;
  loadError: string;
  empty: string;
  continueShopping: string;
  goToCheckout: string;
  vendor: string;
  product: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  subtotal: string;
  remove: string;
  update: string;
};

export default function CartView({ locale, ui }: { locale: Locale; ui: CartUi }) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [data, setData] = useState<CartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/customer/cart", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? ui.loadError);
      }
      const payload = (await res.json()) as CartPayload;
      setData(payload);
      const draft: Record<string, number> = {};
      for (const line of payload.items) {
        draft[line.itemId] = line.quantity;
      }
      setQtyDraft(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateLine(itemId: string) {
    const q = qtyDraft[itemId];
    if (q === undefined || q < 1 || q > 99) return;
    setError(null);
    try {
      const res = await fetch(`/api/v1/customer/cart/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantity: q }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? ui.loadError);
      }
      toast.success(toastDict.cartUpdated);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setError(msg);
      toast.error(msg);
    }
  }

  async function removeLine(itemId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/v1/customer/cart/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? ui.loadError);
      }
      toast.success(toastDict.removedFromCart);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setError(msg);
      toast.error(msg);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error && !data) {
    return (
      <p className="app-alert-error">
        {error}
      </p>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="mt-6 space-y-4" dir={direction}>
        {error ? (
          <p className="app-alert-error">
            {error}
          </p>
        ) : null}
        <p className="app-empty px-6 py-10 text-center text-sm">{ui.empty}</p>
        <Link href="/products" className="text-link text-sm font-medium">
          {ui.continueShopping}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6" dir={direction}>
      {error ? (
        <p className="app-alert-error">
          {error}
        </p>
      ) : null}

      <div className="app-card overflow-x-auto">
        <table className="w-full min-w-[32rem] text-start text-sm">
          <thead className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--foreground)_4%,var(--surface))]">
            <tr>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">{ui.vendor}</th>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">{ui.product}</th>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">{ui.unitPrice}</th>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">{ui.quantity}</th>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">{ui.lineTotal}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {data.items.map((line) => (
              <tr key={line.itemId} className="border-b border-[var(--border)]">
                <td className="px-4 py-3 text-[var(--muted)]">{line.vendorName}</td>
                <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                  <Link href={`/products/${line.productId}`} className="text-link">
                    {line.name}
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatMoney(line.unitPrice, line.currency, locale)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      className="app-input w-16 tabular-nums"
                      value={qtyDraft[line.itemId] ?? line.quantity}
                      onChange={(e) =>
                        setQtyDraft((prev) => ({
                          ...prev,
                          [line.itemId]: Math.min(99, Math.max(1, Number.parseInt(e.target.value, 10) || 1)),
                        }))
                      }
                    />
                    <button type="button" onClick={() => updateLine(line.itemId)} className="btn-secondary btn-press px-2 py-1 text-xs">
                      {ui.update}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums font-medium">
                  {formatMoney(line.lineTotal, line.currency, locale)}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => removeLine(line.itemId)}
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    {ui.remove}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="app-card p-4 text-end text-base font-semibold tabular-nums text-[var(--foreground)]">
        {ui.subtotal}: {formatMoney(data.subtotal, data.currency, locale)}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/checkout" className="btn-primary btn-press">
          {ui.goToCheckout}
        </Link>
        <Link href="/products" className="text-link text-sm font-medium">
          {ui.continueShopping}
        </Link>
      </div>
    </div>
  );
}
