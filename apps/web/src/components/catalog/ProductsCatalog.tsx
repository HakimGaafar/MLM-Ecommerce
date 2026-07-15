"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicProductSort } from "@mlm/shared";
import AppOverlay from "@/components/ui/AppOverlay";
import Pagination from "@/components/Pagination";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { catalogCategoriesUrl } from "@/lib/locale-shared";
import CatalogProductThumb from "./CatalogProductThumb";

type Locale = "en" | "ar";

type Category = { id: string; slug: string; name: string; productCount: number };

type Product = {
  id: string;
  name: string;
  price: string;
  currency: string;
  vendorName: string;
  categoryId: string;
  categoryName: string;
  imageUrl: string | null;
};

type CatalogUi = {
  empty: string;
  emptyFiltered: string;
  soldBy: string;
  price: string;
  viewDetails: string;
  allCategories: string;
  filters: string;
  filtersTitle: string;
  sortLabel: string;
  sortNewest: string;
  sortPriceAsc: string;
  sortPriceDesc: string;
  sortNameAsc: string;
  minPrice: string;
  maxPrice: string;
  search: string;
  applyFilters: string;
  clearFilters: string;
  close: string;
  loading: string;
  loadError: string;
  activeFilters: string;
};

type Filters = {
  sort: PublicProductSort;
  minPrice: string;
  maxPrice: string;
  q: string;
};

const DEFAULT_FILTERS: Filters = { sort: "newest", minPrice: "", maxPrice: "", q: "" };

export default function ProductsCatalog({
  locale,
  ui,
  initialCategoryId = null,
}: {
  locale: Locale;
  ui: CatalogUi;
  /** Deep link from `/products?categoryId=` — applied once categories load. */
  initialCategoryId?: string | null;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const arrow = locale === "ar" ? "←" : "→";

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId ?? null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridKey, setGridKey] = useState(0);
  const [searchInput, setSearchInput] = useState(filters.q);

  /** Keep inline search in sync when filters reset (Clear filters / modal). */
  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  /** Debounce search → filters (removed from modal; lives under categories). */
  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((prev) => {
        if (prev.q === searchInput) return prev;
        return { ...prev, q: searchInput };
      });
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const hasActiveFilters = useMemo(
    () =>
      filters.sort !== "newest" ||
      Boolean(filters.minPrice) ||
      Boolean(filters.maxPrice) ||
      Boolean(filters.q.trim()),
    [filters],
  );

  const loadProducts = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: filters.sort,
      });
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (filters.minPrice) params.set("minPrice", filters.minPrice);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      if (filters.q.trim()) params.set("q", filters.q.trim());

      params.set("locale", locale);
      const res = await fetch(`/api/v1/catalog/products?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: Product[]; total: number };
      setProducts(data.items);
      setTotal(data.total);
      setGridKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedCategoryId, locale, page, pageSize, ui.loadError]);

  useEffect(() => {
    setPage(1);
  }, [filters, selectedCategoryId]);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(catalogCategoriesUrl(locale), {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items: Category[] };
        setCategories(data.items);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        /* categories optional for render */
      }
    })();
    return () => ac.abort();
  }, [locale]);

  /** Drop invalid deep-linked category once the public category list is available. */
  useEffect(() => {
    if (categories.length === 0) return;
    setSelectedCategoryId((prev) => {
      if (prev == null) return prev;
      return categories.some((c) => c.id === prev) ? prev : null;
    });
  }, [categories]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  function selectCategory(id: string | null) {
    setSelectedCategoryId(id);
    setPage(1);
    setGridKey((k) => k + 1);
  }

  function openFilters() {
    setDraftFilters(filters);
    setFilterOpen(true);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setPage(1);
    setFilterOpen(false);
  }

  function clearFilters() {
    const cleared = { ...DEFAULT_FILTERS };
    setDraftFilters(cleared);
    setFilters(cleared);
    setPage(1);
    setFilterOpen(false);
  }

  return (
    <div dir={direction}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-0 flex-1">
          <div
            className="flex gap-2 overflow-x-auto pb-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Categories"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === null}
              onClick={() => selectCategory(null)}
              className={`category-pill shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
                selectedCategoryId === null
                  ? "category-pill-active border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
              }`}
            >
              {ui.allCategories}
            </button>
            {categories.map((cat) => {
              const active = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectCategory(cat.id)}
                  className={`category-pill shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
                    active
                      ? "category-pill-active border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
                  }`}
                >
                  {cat.name}
                  <span className={`ms-1.5 text-xs ${active ? "opacity-90" : "text-[var(--muted)]"}`}>
                    {cat.productCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={openFilters}
          className={`btn-secondary btn-press shrink-0 gap-2 ${hasActiveFilters ? "border-[var(--primary)] text-[var(--primary)]" : ""}`}
        >
          <span aria-hidden>⚙</span>
          {ui.filters}
          {hasActiveFilters ? (
            <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              •
            </span>
          ) : null}
        </button>
      </div>

      <div className="mb-4">
        <label htmlFor="catalog-product-search" className="sr-only">
          {ui.search}
        </label>
        <input
          id="catalog-product-search"
          type="search"
          className="app-input w-full max-w-xl"
          placeholder={ui.search}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          autoComplete="off"
        />
      </div>

      {error ? (
        <p className="mb-4 app-alert-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : products.length === 0 ? (
        <p className="app-empty px-6 py-12 text-center text-sm">
          {hasActiveFilters || selectedCategoryId ? ui.emptyFiltered : ui.empty}
        </p>
      ) : (
        <ul key={gridKey} className="product-grid-enter grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <li
              key={product.id}
              className="animate-stagger"
              style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
            >
              <Link
                href={`/products/${product.id}`}
                className="app-card app-card-hover flex h-full flex-col overflow-hidden"
              >
                <div className="relative aspect-[4/3] bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))]">
                  <CatalogProductThumb
                    src={product.imageUrl}
                    alt={product.name}
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                  <span className="absolute bottom-2 start-2 z-10 rounded-full bg-[var(--surface)]/90 px-2 py-0.5 text-xs font-medium text-[var(--muted)] backdrop-blur-sm">
                    {product.categoryName}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="line-clamp-2 font-semibold text-[var(--foreground)]">{product.name}</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {ui.soldBy}: {product.vendorName}
                  </p>
                  <p className="mt-auto pt-3 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {ui.price}: {formatMoney(product.price, product.currency, locale)}
                  </p>
                  <span className="mt-2 text-sm font-medium text-[var(--primary)]">
                    {ui.viewDetails} {arrow}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {products.length > 0 ? (
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          labels={getPaginationLabels(locale)}
          className="mt-6"
        />
      ) : null}

      <AppOverlay
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        panelSize="content"
        panelClassName="app-card max-w-md p-5"
        ariaLabelledBy="filter-title"
        zIndex={200}
      >
          <div dir={direction}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="filter-title" className="text-lg font-semibold text-[var(--foreground)]">
                {ui.filtersTitle}
              </h2>
              <button type="button" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setFilterOpen(false)}>
                {ui.close}
              </button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{ui.sortLabel}</span>
                <select
                  className="app-input"
                  value={draftFilters.sort}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, sort: e.target.value as PublicProductSort }))}
                >
                  <option value="newest">{ui.sortNewest}</option>
                  <option value="price_asc">{ui.sortPriceAsc}</option>
                  <option value="price_desc">{ui.sortPriceDesc}</option>
                  <option value="name_asc">{ui.sortNameAsc}</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">{ui.minPrice}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="app-input"
                    value={draftFilters.minPrice}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, minPrice: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">{ui.maxPrice}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="app-input"
                    value={draftFilters.maxPrice}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" className="btn-primary btn-press flex-1" onClick={applyFilters}>
                {ui.applyFilters}
              </button>
              <button type="button" className="btn-secondary btn-press" onClick={clearFilters}>
                {ui.clearFilters}
              </button>
            </div>
          </div>
      </AppOverlay>
    </div>
  );
}
