"use client";

import Link from "next/link";
import { useState } from "react";
import { VENDOR_PRODUCT_IMPORT_CSV_TEMPLATE } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";

type ImportResult = {
  createdCount: number;
  failedCount: number;
  results: Array<
    | { row: number; status: "created"; productId: string; name: string; warning?: string }
    | { row: number; status: "failed"; message: string }
  >;
};

type Ui = {
  columnsTitle: string;
  columnsHelp: string;
  downloadTemplate: string;
  chooseFile: string;
  fileHint: string;
  importButton: string;
  importing: string;
  importSuccess: string;
  importError: string;
  resultTitle: string;
  resultCreated: string;
  resultFailed: string;
  row: string;
  statusCreated: string;
  statusFailed: string;
  editProduct: string;
  warningQty: string;
};

export default function VendorProductImportForm({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadTemplate() {
    const blob = new Blob([VENDOR_PRODUCT_IMPORT_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    setError(null);
    if (!file) {
      setFileName(null);
      setCsvText(null);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      setError(ui.importError);
      setCsvText(null);
    };
    reader.readAsText(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!csvText?.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/vendor/products/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = (await res.json().catch(() => null)) as ImportResult & { error?: string; code?: string };
      if (!res.ok) {
        throw new Error(data?.error ?? ui.importError);
      }
      setResult(data);
      toast.success(
        ui.importSuccess
          .replace("{created}", String(data.createdCount))
          .replace("{failed}", String(data.failedCount)),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.importError;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-card p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{ui.columnsTitle}</h2>
        <p className="mt-2 text-sm text-[var(--muted)] whitespace-pre-line">{ui.columnsHelp}</p>
        <button type="button" onClick={downloadTemplate} className="mt-4 text-sm font-medium text-[var(--primary)] underline-offset-4 hover:underline">
          {ui.downloadTemplate}
        </button>
      </section>

      <form onSubmit={onSubmit} className="app-card space-y-4 p-4 sm:p-6">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)]">{ui.chooseFile}</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFileChange}
            className="mt-2 block w-full text-sm text-[var(--foreground)] file:me-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
          />
          <p className="mt-2 text-xs text-[var(--muted)]">{ui.fileHint}</p>
          {fileName ? (
            <p className="mt-1 text-sm text-[var(--foreground)]">
              {fileName}
            </p>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={!csvText?.trim() || submitting}>
          {submitting ? ui.importing : ui.importButton}
        </button>
      </form>

      {result ? (
        <section className="app-card p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{ui.resultTitle}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {ui.resultCreated.replace("{n}", String(result.createdCount))}{" "}
            {ui.resultFailed.replace("{n}", String(result.failedCount))}
          </p>
          <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto">
            {result.results.map((r) => (
              <li
                key={`${r.row}-${r.status}`}
                className={`px-3 py-2 text-sm ${
                  r.status === "created" ? "app-callout-success" : "app-alert-error"
                }`}
              >
                <span className="font-medium">
                  {ui.row} {r.row}:{" "}
                </span>
                {r.status === "created" ? (
                  <>
                    <span className="font-medium text-[var(--success)]">{ui.statusCreated}</span> — {r.name}{" "}
                    <Link href={`/vendor/products/${r.productId}/edit`} className="font-medium text-[var(--primary)] underline-offset-4 hover:underline">
                      {ui.editProduct}
                    </Link>
                    {r.warning ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">{r.warning}</p>
                    ) : null}
                  </>
                ) : (
                  <span className="text-red-800 dark:text-red-200">
                    {ui.statusFailed}: {r.message}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
