"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";
import { useAppLocale } from "@/components/providers/LocaleProvider";

type AddToCartText = {
  quantity: string;
  add: string;
  adding: string;
  error: string;
  success: string;
};

export default function AddToCart({
  productId,
  ui,
  viewCartLabel,
  toastAdded,
}: {
  productId: string;
  ui: AddToCartText;
  viewCartLabel: string;
  toastAdded: string;
}) {
  const router = useRouter();
  const locale = useAppLocale();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "adding" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("adding");
    setMessage(null);
    try {
      const response = await fetch("/api/v1/customer/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId, quantity }),
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
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">{ui.quantity}</span>
          <input
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(e) => setQuantity(Math.min(99, Math.max(1, Number.parseInt(e.target.value, 10) || 1)))}
            className="app-input w-20 tabular-nums"
          />
        </label>
        <button type="submit" disabled={status === "adding"} className="btn-primary btn-press">
          {status === "adding" ? ui.adding : ui.add}
        </button>
      </form>
      {message ? (
        <p
          className={`text-sm ${status === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
        >
          {message}
        </p>
      ) : null}
      <Link href="/cart" className="inline-block text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline">
        {viewCartLabel}
      </Link>
    </div>
  );
}
