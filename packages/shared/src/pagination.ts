/** Default rows per page (Option A — UI and API). */
export const DEFAULT_PAGE_SIZE = 5;

/** Upper bound for `pageSize` query param. */
export const MAX_PAGE_SIZE = 50;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export function normalizePagination(input?: { page?: number; pageSize?: number }) {
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, input?.pageSize ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
}

export function buildPaginatedResult<T>(
  items: T[] | undefined,
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const safeItems = items ?? [];
  const skip = (page - 1) * pageSize;
  return {
    items: safeItems,
    total,
    page,
    pageSize,
    hasMore: skip + safeItems.length < total,
  };
}

/** Parse `page` / `pageSize` from URL search params. */
export function parsePaginationSearchParams(
  params: URLSearchParams | { get(name: string): string | null },
): { page: number; pageSize: number; skip: number; take: number } {
  const pageRaw = params.get("page");
  const pageSizeRaw = params.get("pageSize");
  return normalizePagination({
    page: pageRaw ? Number.parseInt(pageRaw, 10) : undefined,
    pageSize: pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : undefined,
  });
}
