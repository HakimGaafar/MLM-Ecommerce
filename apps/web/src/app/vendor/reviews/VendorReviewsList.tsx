"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { VendorReviewListTab } from "@mlm/shared";
import Pagination from "@/components/Pagination";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

type ReviewRow = {
  id: string;
  orderItemId: string;
  orderId: string;
  orderNo: string;
  productId: string | null;
  productName: string;
  buyerName: string;
  productStars: number;
  vendorStars: number;
  deliveryStars: number;
  comment: string | null;
  ratedAt: string;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  tabAll: string;
  tabLow: string;
  tabCommented: string;
  searchPlaceholder: string;
  search: string;
  product: string;
  customer: string;
  order: string;
  productRating: string;
  vendorRating: string;
  deliveryRating: string;
  comment: string;
  viewOrder: string;
  viewProduct: string;
  filteredByLine: string;
  clearFilter: string;
  stars: string;
};

const TABS: { key: VendorReviewListTab; labelKey: keyof Pick<Ui, "tabAll" | "tabLow" | "tabCommented"> }[] = [
  { key: "all", labelKey: "tabAll" },
  { key: "low", labelKey: "tabLow" },
  { key: "commented", labelKey: "tabCommented" },
];

function StarRow({ label, value, starsLabel }: { label: string; value: number; starsLabel: string }) {
  return (
    <p className="text-sm text-[var(--foreground)]">
      <span className="text-[var(--muted)]">{label}: </span>
      <span className="font-medium tabular-nums">{value}/5</span>
      <span className="ms-1 text-amber-500" aria-hidden>
        {"★".repeat(value)}
        {"☆".repeat(5 - value)}
      </span>
      <span className="sr-only">
        {starsLabel}: {value} / 5
      </span>
    </p>
  );
}

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function VendorReviewsList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const searchParams = useSearchParams();
  const orderItemIdFromUrl = searchParams.get("orderItemId") ?? undefined;

  const [tab, setTab] = useState<VendorReviewListTab>("all");
  const [page, setPage] = useState(1);
  const pageSize = LIST_PAGE_SIZE;
  const [q, setQ] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [items, setItems] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (tab !== "all") params.set("tab", tab);
    if (q) params.set("q", q);
    if (orderItemIdFromUrl) params.set("orderItemId", orderItemIdFromUrl);
    return params.toString();
  }, [tab, q, orderItemIdFromUrl, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [tab, q, orderItemIdFromUrl]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/vendor/reviews?${queryString}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { items: ReviewRow[]; total: number };
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [queryString, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(searchDraft.trim());
  }

  return (
    <div>
      {orderItemIdFromUrl ? (
        <p className="mb-4 rounded-lg border border-[var(--primary)]/30 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-3 py-2 text-sm">
          {ui.filteredByLine}{" "}
          <Link href="/vendor/reviews" className="font-medium text-[var(--primary)] underline-offset-4 hover:underline">
            {ui.clearFilter}
          </Link>
        </p>
      ) : null}

      <form onSubmit={applySearch} className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder={ui.searchPlaceholder}
          className="min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <button type="submit" className="btn-neutral rounded-lg px-4 py-2 text-sm font-medium">
          {ui.search}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {ui[t.labelKey]}
          </button>
        ))}
      </div>

      {!loading && !error ? (
        <p className="mt-4 text-xs text-[var(--muted)] tabular-nums">
          {total} {locale === "ar" ? "تقييم" : total === 1 ? "review" : "reviews"}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : error ? (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((row) => (
            <li key={row.id} className="app-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--primary)]">{ui.product}</p>
                  <p className="font-medium text-[var(--foreground)]">{row.productName}</p>
                </div>
                <time className="text-xs text-[var(--muted)]">{formatDate(row.ratedAt, locale)}</time>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {ui.customer}: {row.buyerName} · {ui.order}:{" "}
                <Link
                  href={`/vendor/orders/${row.orderId}`}
                  className="font-medium text-[var(--primary)] underline-offset-4 hover:underline"
                >
                  {row.orderNo}
                </Link>
              </p>
              <div className="mt-3 space-y-1">
                <StarRow label={ui.productRating} value={row.productStars} starsLabel={ui.stars} />
                <StarRow label={ui.vendorRating} value={row.vendorStars} starsLabel={ui.stars} />
                <StarRow label={ui.deliveryRating} value={row.deliveryStars} starsLabel={ui.stars} />
              </div>
              {row.comment ? (
                <p className="mt-3 rounded-lg bg-[var(--muted-bg)] p-3 text-sm text-[var(--foreground)]">
                  <span className="font-medium">{ui.comment}: </span>
                  {row.comment}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <Link
                  href={`/vendor/orders/${row.orderId}`}
                  className="font-medium text-[var(--primary)] underline-offset-4 hover:underline"
                >
                  {ui.viewOrder}
                </Link>
                {row.productId ? (
                  <Link
                    href={`/products/${row.productId}`}
                    className="font-medium text-[var(--primary)] underline-offset-4 hover:underline"
                  >
                    {ui.viewProduct}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 ? (
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          labels={getPaginationLabels(locale)}
          className="mt-6"
        />
      ) : null}
    </div>
  );
}
