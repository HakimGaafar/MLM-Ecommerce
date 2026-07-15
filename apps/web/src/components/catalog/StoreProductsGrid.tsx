"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CatalogProductThumb from "@/components/catalog/CatalogProductThumb";
import Pagination from "@/components/Pagination";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

type Product = {
  id: string;
  name: string;
  price: string;
  currency: string;
  categoryId: string;
  categoryName: string;
  imageUrl: string | null;
};

type Ui = {
  noProducts: string;
  viewProduct: string;
  loading: string;
  loadError: string;
};

export default function StoreProductsGrid({
  slug,
  locale,
  ui,
}: {
  slug: string;
  locale: Locale;
  ui: Ui;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const arrow = locale === "ar" ? "←" : "→";
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/public/stores/${encodeURIComponent(slug)}/products?page=${page}&pageSize=${pageSize}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: Product[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [slug, page, pageSize, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && items.length === 0) {
    return <p className="mt-6 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error && items.length === 0) {
    return <p className="mt-6 app-alert-error">{error}</p>;
  }

  if (items.length === 0) {
    return <p className="app-empty mt-6 px-6 py-10 text-center text-sm">{ui.noProducts}</p>;
  }

  return (
    <div dir={direction}>
      {error ? <p className="mb-4 app-alert-error">{error}</p> : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={`/products/${p.id}`}
              className="app-card app-card-hover flex h-full flex-col overflow-hidden"
            >
              <div className="relative aspect-[4/3] bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))]">
                <CatalogProductThumb
                  src={p.imageUrl}
                  alt={p.name}
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
                <span className="absolute bottom-2 start-2 z-10 rounded-full bg-[var(--surface)]/90 px-2 py-0.5 text-xs font-medium text-[var(--muted)] backdrop-blur-sm">
                  {p.categoryName}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="line-clamp-2 font-semibold text-[var(--foreground)]">{p.name}</p>
                <p className="mt-2 tabular-nums text-sm text-[var(--muted)]">
                  {formatMoney(p.price, p.currency, locale)}
                </p>
                <span className="mt-auto pt-3 text-sm font-medium text-[var(--primary)]">
                  {ui.viewProduct} {arrow}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        labels={getPaginationLabels(locale)}
        className="mt-6"
      />
    </div>
  );
}
