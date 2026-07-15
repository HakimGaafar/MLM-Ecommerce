"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { VendorProductQuestionListTab } from "@mlm/shared";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

type QuestionRow = {
  id: string;
  productId: string;
  productName: string;
  askerName: string;
  questionText: string;
  answerText: string | null;
  isPublished: boolean;
  createdAt: string;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  tabUnanswered: string;
  tabAll: string;
  product: string;
  customer: string;
  question: string;
  answer: string;
  answerPlaceholder: string;
  publishAnswer: string;
  submitAnswer: string;
  submitting: string;
  answerSuccess: string;
  viewProduct: string;
  statusPublished: string;
  statusPending: string;
};

const TABS: { key: VendorProductQuestionListTab; labelKey: "tabUnanswered" | "tabAll" }[] = [
  { key: "unanswered", labelKey: "tabUnanswered" },
  { key: "all", labelKey: "tabAll" },
];

export default function VendorQuestionsList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const [tab, setTab] = useState<VendorProductQuestionListTab>("unanswered");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [publishFlags, setPublishFlags] = useState<Record<string, boolean>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/vendor/questions?tab=${tab}&page=${page}&pageSize=${pageSize}`,
        {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { items: QuestionRow[]; total: number };
      setItems(data.items ?? []);
      setTotal(data.total);
      const nextPublish: Record<string, boolean> = {};
      for (const row of data.items) {
        nextPublish[row.id] = true;
      }
      setPublishFlags(nextPublish);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, ui.loadError]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitAnswer(questionId: string) {
    const answerText = (answers[questionId] ?? "").trim();
    if (!answerText || submittingId) return;
    setSubmittingId(questionId);
    try {
      const res = await fetch(`/api/v1/vendor/questions/${questionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerText,
          publish: publishFlags[questionId] ?? true,
        }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      toast.success(ui.answerSuccess);
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div>
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
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.isPublished && row.answerText
                      ? "app-badge-success"
                      : "app-badge-warning"
                  }`}
                >
                  {row.isPublished && row.answerText ? ui.statusPublished : ui.statusPending}
                </span>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                {ui.customer}: {row.askerName}
              </p>
              <p className="mt-2 text-sm text-[var(--foreground)]">
                <span className="font-medium">{ui.question}: </span>
                {row.questionText}
              </p>
              {row.answerText ? (
                <p className="mt-3 text-sm text-[var(--foreground)]">
                  <span className="font-medium">{ui.answer}: </span>
                  {row.answerText}
                </p>
              ) : (
                <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                  <label className="block text-sm font-medium text-[var(--foreground)]">{ui.answer}</label>
                  <textarea
                    value={answers[row.id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    placeholder={ui.answerPlaceholder}
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={publishFlags[row.id] ?? true}
                      onChange={(e) =>
                        setPublishFlags((prev) => ({ ...prev, [row.id]: e.target.checked }))
                      }
                    />
                    {ui.publishAnswer}
                  </label>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={submittingId === row.id || (answers[row.id] ?? "").trim().length < 1}
                    onClick={() => void submitAnswer(row.id)}
                  >
                    {submittingId === row.id ? ui.submitting : ui.submitAnswer}
                  </button>
                </div>
              )}
              <Link
                href={`/products/${row.productId}`}
                className="mt-4 inline-block text-sm font-medium text-[var(--primary)] underline-offset-4 hover:underline"
              >
                {ui.viewProduct}
              </Link>
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
