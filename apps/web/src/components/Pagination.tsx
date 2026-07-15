"use client";

import Link from "next/link";
import { DEFAULT_PAGE_SIZE } from "@mlm/shared";

export type PaginationLabels = {
  prev: string;
  next: string;
  pageOf: string;
};

type PaginationProps = {
  page: number;
  /** Total item count (not page count). */
  total: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  /** When set, renders Next.js links instead of buttons (for server-driven lists). */
  linkBasePath?: string;
  /** Extra query keys preserved in link mode (e.g. filters). */
  linkQuery?: Record<string, string | undefined>;
  labels: PaginationLabels;
  className?: string;
};

function totalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

function buildHref(
  basePath: string,
  page: number,
  linkQuery?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (linkQuery) {
    for (const [key, value] of Object.entries(linkQuery)) {
      if (value !== undefined && value !== "") params.set(key, value);
    }
  }
  const q = params.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export default function Pagination({
  page,
  total,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  linkBasePath,
  linkQuery,
  labels,
  className = "",
}: PaginationProps) {
  const pages = totalPages(total, pageSize);
  if (total <= pageSize && page <= 1) return null;

  const pageLabel = labels.pageOf
    .replaceAll("{page}", String(page))
    .replaceAll("{total}", String(pages));

  const prevDisabled = page <= 1;
  const nextDisabled = page >= pages;

  const prevClass =
    "rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40";
  const nextClass = prevClass;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)] ${className}`}
    >
      <span>{pageLabel}</span>
      <div className="flex gap-2">
        {linkBasePath ? (
          <>
            {prevDisabled ? (
              <span className={`${prevClass} pointer-events-none opacity-40`}>{labels.prev}</span>
            ) : (
              <Link href={buildHref(linkBasePath, page - 1, linkQuery)} className={prevClass}>
                {labels.prev}
              </Link>
            )}
            {nextDisabled ? (
              <span className={`${nextClass} pointer-events-none opacity-40`}>{labels.next}</span>
            ) : (
              <Link href={buildHref(linkBasePath, page + 1, linkQuery)} className={nextClass}>
                {labels.next}
              </Link>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className={prevClass}
              disabled={prevDisabled}
              onClick={() => onPageChange?.(page - 1)}
            >
              {labels.prev}
            </button>
            <button
              type="button"
              className={nextClass}
              disabled={nextDisabled}
              onClick={() => onPageChange?.(page + 1)}
            >
              {labels.next}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
