"use client";

import type { CustomerOrderLineItemDto } from "@mlm/domain";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type RatingUi = {
  sectionTitle: string;
  productLabel: string;
  vendorLabel: string;
  deliveryLabel: string;
  commentLabel: string;
  commentPlaceholder: string;
  save: string;
  saving: string;
  saveError: string;
  productShort: string;
  vendorShort: string;
  deliveryShort: string;
  starsSuffix: string;
};

export type LineItemRatingUi = RatingUi;

type Line = Pick<CustomerOrderLineItemDto, "id" | "canRate" | "rating">;

function StarSelect({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (n: number) => void;
  id: string;
}) {
  return (
    <select
      id={id}
      className="app-input w-auto px-2 py-1"
      value={value}
      onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

export default function LineItemRatingBlock({
  line,
  locale,
  ui,
}: {
  line: Line;
  locale: Locale;
  ui: RatingUi;
}) {
  const router = useRouter();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const r = line.rating;
  const [productStars, setProductStars] = useState(r?.productStars ?? 5);
  const [vendorStars, setVendorStars] = useState(r?.vendorStars ?? 5);
  const [deliveryStars, setDeliveryStars] = useState(r?.deliveryStars ?? 5);
  const [comment, setComment] = useState(r?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!line.canRate) {
    return null;
  }

  async function onSave() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/customer/ratings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderItemId: line.id,
          productStars,
          vendorStars,
          deliveryStars,
          comment: comment.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? ui.saveError);
      }
      toast.success(toastDict.ratingSaved);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.saveError;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--table-head-bg)] p-3 text-sm dark:border-[var(--border-strong)]" dir={direction}>
      <p className="font-medium text-[var(--foreground)]">{ui.sectionTitle}</p>
      {r ? (
        <div className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
          <p>
            {ui.productShort}: {r.productStars} {ui.starsSuffix}
          </p>
          <p>
            {ui.vendorShort}: {r.vendorStars} {ui.starsSuffix}
          </p>
          <p>
            {ui.deliveryShort}: {r.deliveryStars} {ui.starsSuffix}
          </p>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="text-[var(--muted)]">{ui.productLabel}</span>
          <div className="mt-1">
            <StarSelect id={`${line.id}-p`} value={productStars} onChange={setProductStars} />
          </div>
        </label>
        <label className="block text-xs">
          <span className="text-[var(--muted)]">{ui.vendorLabel}</span>
          <div className="mt-1">
            <StarSelect id={`${line.id}-v`} value={vendorStars} onChange={setVendorStars} />
          </div>
        </label>
        <label className="block text-xs">
          <span className="text-[var(--muted)]">{ui.deliveryLabel}</span>
          <div className="mt-1">
            <StarSelect id={`${line.id}-d`} value={deliveryStars} onChange={setDeliveryStars} />
          </div>
        </label>
      </div>
      <label className="mt-3 block text-xs">
        <span className="text-[var(--muted)]">{ui.commentLabel}</span>
        <textarea
          className="mt-1 w-full rounded border border-[var(--border-strong)] bg-white px-2 py-1.5 dark:bg-[var(--surface)]"
          rows={2}
          maxLength={2000}
          placeholder={ui.commentPlaceholder}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        className="mt-3 btn-neutral rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        onClick={() => void onSave()}
      >
        {busy ? ui.saving : ui.save}
      </button>
    </div>
  );
}
