"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  storeName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  onboardingSubmittedAt: string | null;
};

export default function AdminOnboardingQueue({
  locale,
  ui,
}: {
  locale: "en" | "ar";
  ui: {
    loading: string;
    loadError: string;
    empty: string;
    store: string;
    owner: string;
    submitted: string;
    review: string;
  };
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/vendors/onboarding?page=1&pageSize=50", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: Row[] };
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-8" dir={direction}>
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--muted)]">
          {ui.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[36rem] text-start text-sm">
            <thead className="bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-3">{ui.store}</th>
                <th className="px-4 py-3">{ui.owner}</th>
                <th className="px-4 py-3">{ui.submitted}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-[var(--table-row-border)]">
                  <td className="px-4 py-3 font-medium">
                    {row.storeName}
                    <span className="ms-2 text-xs text-[var(--muted)]">/{row.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.ownerName}
                    <div className="text-xs text-[var(--muted)]">{row.ownerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {row.onboardingSubmittedAt
                      ? new Date(row.onboardingSubmittedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={`/admin/vendors/onboarding/${row.id}`}
                      className="text-link font-medium"
                    >
                      {ui.review}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
