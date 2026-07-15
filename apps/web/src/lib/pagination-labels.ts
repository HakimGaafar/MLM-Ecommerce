import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import type { PaginationLabels } from "@/components/Pagination";

export function getPaginationLabels(locale: "en" | "ar"): PaginationLabels {
  const dict = locale === "ar" ? ar : en;
  return dict.pagination as PaginationLabels;
}
