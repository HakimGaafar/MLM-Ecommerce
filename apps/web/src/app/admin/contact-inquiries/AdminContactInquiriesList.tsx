"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type InquiryStatus = "NEW" | "READ" | "RESOLVED";

type Inquiry = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  status: InquiryStatus;
  marketCode: string;
  createdAt: string;
};

type Ui = {
  loading: string;
  loadError: string;
  saveError: string;
  empty: string;
  allStatuses: string;
  name: string;
  email: string;
  market: string;
  received: string;
  message: string;
  status: string;
  new: string;
  read: string;
  resolved: string;
  previous: string;
  next: string;
  page: string;
  total: string;
};

const PAGE_SIZE = 20;

export default function AdminContactInquiriesList({
  locale,
  ui,
}: {
  locale: "en" | "ar";
  ui: Ui;
}) {
  const toast = useToast();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [status, setStatus] = useState<"" | InquiryStatus>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const labels: Record<InquiryStatus, string> = {
    NEW: ui.new,
    READ: ui.read,
    RESOLVED: ui.resolved,
  };

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (status) params.set("status", status);
      const response = await fetch(`/api/v1/admin/contact-inquiries?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("load");
      const data = (await response.json()) as {
        items: Inquiry[];
        total: number;
        hasMore: boolean;
      };
      setItems(data.items);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch {
      toast.error(ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [page, status, toast, ui.loadError]);

  useEffect(() => {
    // Data fetching intentionally updates this client-side list after mount/filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function updateStatus(inquiry: Inquiry, nextStatus: InquiryStatus) {
    if (nextStatus === inquiry.status || savingId) return;
    setSavingId(inquiry.id);
    try {
      const response = await fetch(`/api/v1/admin/contact-inquiries/${inquiry.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("save");
      setItems((current) =>
        current.map((item) => (item.id === inquiry.id ? { ...item, status: nextStatus } : item)),
      );
    } catch {
      toast.error(ui.saveError);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <label className="text-sm font-medium">
          {ui.status}
          <select
            className="app-input mt-1 min-w-48"
            value={status}
            onChange={(event) => {
              setLoading(true);
              setStatus(event.target.value as "" | InquiryStatus);
              setPage(1);
            }}
          >
            <option value="">{ui.allStatuses}</option>
            <option value="NEW">{ui.new}</option>
            <option value="READ">{ui.read}</option>
            <option value="RESOLVED">{ui.resolved}</option>
          </select>
        </label>
        <p className="text-sm text-[var(--muted)]">
          {ui.total.replace("{count}", String(total))}
        </p>
      </div>

      {loading ? <p className="text-sm text-[var(--muted)]">{ui.loading}</p> : null}
      {!loading && items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
          {ui.empty}
        </div>
      ) : null}

      <div className="space-y-4">
        {items.map((inquiry) => (
          <article
            key={inquiry.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold">
                  {inquiry.firstName} {inquiry.lastName}
                </p>
                <a
                  className="mt-1 block text-sm text-link hover:underline"
                  href={`mailto:${inquiry.email}`}
                  dir="ltr"
                >
                  {inquiry.email}
                </a>
              </div>
              <label className="text-xs font-medium text-[var(--muted)]">
                {ui.status}
                <select
                  className="app-input mt-1 min-w-32 text-sm"
                  value={inquiry.status}
                  disabled={savingId === inquiry.id}
                  onChange={(event) =>
                    void updateStatus(inquiry, event.target.value as InquiryStatus)
                  }
                >
                  {(Object.keys(labels) as InquiryStatus[]).map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--muted)]">{ui.market}</dt>
                <dd className="mt-0.5 font-medium">{inquiry.marketCode}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">{ui.received}</dt>
                <dd className="mt-0.5">
                  {new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(inquiry.createdAt))}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg bg-[var(--surface-elevated)] p-4">
              <p className="text-xs font-medium text-[var(--muted)]">{ui.message}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                {inquiry.message}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={page <= 1 || loading}
          onClick={() => {
            setLoading(true);
            setPage((value) => Math.max(1, value - 1));
          }}
        >
          {ui.previous}
        </button>
        <span className="text-sm text-[var(--muted)]">
          {ui.page.replace("{page}", String(page))}
        </span>
        <button
          type="button"
          className="btn-secondary"
          disabled={!hasMore || loading}
          onClick={() => {
            setLoading(true);
            setPage((value) => value + 1);
          }}
        >
          {ui.next}
        </button>
      </div>
    </section>
  );
}
