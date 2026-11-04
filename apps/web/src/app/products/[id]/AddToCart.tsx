"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";
import { useAppLocale } from "@/components/providers/LocaleProvider";
import { formatMoney } from "@/lib/format-currency";

type AddToCartText = {
  quantity: string;
  add: string;
  adding: string;
  error: string;
  success: string;
  selectOption?: string;
};

type VariantOption = {
  id: string;
  title: string;
  price: string;
  currency: string;
  quantity: number;
  inStock: boolean;
};

export default function AddToCart({
  productId,
  ui,
  viewCartLabel,
  toastAdded,
  variants = [],
}: {
  productId: string;
  ui: AddToCartText;
  viewCartLabel: string;
  toastAdded: string;
  variants?: VariantOption[];
}) {
  const router = useRouter();
  const locale = useAppLocale();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState(variants.find((v) => v.inStock)?.id ?? variants[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "adding" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => variants.find((v) => v.id === variantId) ?? null,
    [variants, variantId],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (variants.length > 0 && !variantId) {
      setStatus("error");
      setMessage(ui.selectOption ?? ui.error);
      return;
    }
    setStatus("adding");
    setMessage(null);
    try {
      const response = await fetch("/api/v1/customer/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId,
          quantity,
          ...(variantId ? { variantId } : {}),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? ui.error);
      }
      setStatus("success");
      setMessage(ui.success);
      toast.success(toastAdded);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.error;
      setStatus("error");
      setMessage(msg);
      toast.error(msg || toastDict.addToCartFailed);
    }
  }

  return (
    <div className="mt-8 space-y-3 border-t border-[var(--border)] pt-6">
      {variants.length > 0 ? (
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">{ui.selectOption ?? "Option"}</span>
          <select
            className="app-input w-full max-w-md"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.inStock}>
                {v.title}
                {" — "}
                {formatMoney(v.price, v.currency, locale)}
                {!v.inStock ? " (out of stock)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {selected ? (
        <p className="text-sm tabular-nums text-[var(--muted)]">
          {formatMoney(selected.price, selected.currency, locale)}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">{ui.quantity}</span>
          <input
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(e) => setQuantity(Math.min(99, Math.max(1, Number.parseInt(e.target.value, 10) || 1)))}
            onWheel={(e) => e.currentTarget.blur()}
            className="app-input w-20 tabular-nums"
          />
        </label>
        <button type="submit" disabled={status === "adding"} className="btn-primary btn-press">
          {status === "adding" ? ui.adding : ui.add}
        </button>
      </form>
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
          {message}
        </p>
      ) : null}
      {status === "success" ? (
        <Link href="/cart" className="text-sm font-medium text-link">
          {viewCartLabel}
        </Link>
      ) : null}
    </div>
  );
}
