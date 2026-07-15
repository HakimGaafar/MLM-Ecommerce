"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

type QuestionRow = {
  id: string;
  questionText: string;
  answerText: string;
  askerDisplayName: string;
  answeredAt: string;
};

type Ui = {
  title: string;
  empty: string;
  askedBy: string;
  answerLabel: string;
  askTitle: string;
  askPlaceholder: string;
  askSubmit: string;
  askSubmitting: string;
  askSuccess: string;
  loginToAsk: string;
  loadError: string;
  loading: string;
};

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProductQuestions({
  productId,
  locale,
  ui,
  canAsk,
}: {
  productId: string;
  locale: Locale;
  ui: Ui;
  canAsk: boolean;
}) {
  const toast = useToast();
  const [items, setItems] = useState<QuestionRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/catalog/products/${productId}/questions?page=${page}&pageSize=${pageSize}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: QuestionRow[]; total: number };
      setItems(data.items ?? []);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [productId, page, pageSize, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const text = questionText.trim();
    if (text.length < 3 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/customer/products/${productId}/questions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText: text }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      setQuestionText("");
      toast.success(ui.askSuccess);
      setPage(1);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ui.loadError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="app-card mt-6 p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{ui.title}</h2>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {items.map((q) => (
            <li key={q.id} className="rounded-lg border border-[var(--border)] p-4">
              <p className="text-sm font-medium text-[var(--foreground)]">{q.questionText}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {ui.askedBy}: {q.askerDisplayName} · {formatDate(q.answeredAt, locale)}
              </p>
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--primary)]">{ui.answerLabel}</p>
                <p className="mt-1 text-sm text-[var(--foreground)]">{q.answerText}</p>
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
          className="mt-4"
        />
      ) : null}

      <div className="mt-6 border-t border-[var(--border)] pt-6">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{ui.askTitle}</h3>
        {canAsk ? (
          <form onSubmit={handleAsk} className="mt-3 space-y-3">
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={ui.askPlaceholder}
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
            />
            <button type="submit" className="btn-primary" disabled={submitting || questionText.trim().length < 3}>
              {submitting ? ui.askSubmitting : ui.askSubmit}
            </button>
          </form>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-[var(--muted)]">{ui.loginToAsk}</p>
            <Link href="/login" className="btn-primary inline-block text-center">
              {locale === "ar" ? "تسجيل الدخول" : "Sign in"}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
