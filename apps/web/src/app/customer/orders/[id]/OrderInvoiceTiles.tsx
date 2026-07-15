"use client";

import { useEffect, useState } from "react";
import { downloadInvoicePdf } from "@/lib/invoices/download-invoice-pdf";

type Locale = "en" | "ar";

type InvoiceListItem = {
  vendorId: string;
  vendorName: string;
  invoiceNo: string | null;
  available: boolean;
  profileComplete: boolean;
};

type Ui = {
  title: string;
  orderSummary: string;
  downloadVendorInvoice: string;
  unavailable: string;
  gateClosed: string;
  orderNotEligible: string;
  profileIncomplete: string;
  loading: string;
  loadError: string;
  downloadError: string;
  downloading: string;
};

export default function OrderInvoiceTiles({
  orderId,
  invoiceEligible,
  finalInvoiceAllowed,
  locale,
  ui,
}: {
  orderId: string;
  invoiceEligible: boolean;
  finalInvoiceAllowed: boolean;
  locale: Locale;
  ui: Ui;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(invoiceEligible && finalInvoiceAllowed);
  const [error, setError] = useState<string | null>(null);
  const [downloadingVendorId, setDownloadingVendorId] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceEligible || !finalInvoiceAllowed) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/customer/orders/${orderId}/invoices`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(ui.loadError);
        const data = (await res.json()) as { invoices: InvoiceListItem[] };
        if (!cancelled) setInvoices(data.invoices);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : ui.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, invoiceEligible, finalInvoiceAllowed, ui.loadError]);

  async function handleDownload(vendorId: string) {
    setDownloadingVendorId(vendorId);
    setError(null);
    try {
      await downloadInvoicePdf(
        `/api/v1/customer/orders/${orderId}/invoices/${vendorId}/vendor-sale`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.downloadError);
    } finally {
      setDownloadingVendorId(null);
    }
  }

  return (
    <section
      className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 dark:border-[var(--border)] dark:bg-[var(--surface)]"
      dir={direction}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.title}</h2>

      {!invoiceEligible ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{ui.orderNotEligible}</p>
      ) : !finalInvoiceAllowed ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{ui.gateClosed}</p>
      ) : loading ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : invoices.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{ui.unavailable}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {invoices.map((inv) => (
            <li
              key={inv.vendorId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-4 py-3"
            >
              <div>
                <p className="font-medium text-[var(--foreground)]">{inv.vendorName}</p>
                {inv.invoiceNo ? (
                  <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">{inv.invoiceNo}</p>
                ) : null}
                {!inv.profileComplete ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{ui.profileIncomplete}</p>
                ) : null}
              </div>
              {inv.available ? (
                <button
                  type="button"
                  className="btn-secondary btn-press shrink-0 disabled:opacity-50"
                  disabled={downloadingVendorId === inv.vendorId}
                  onClick={() => void handleDownload(inv.vendorId)}
                >
                  {downloadingVendorId === inv.vendorId ? ui.downloading : ui.downloadVendorInvoice}
                </button>
              ) : (
                <span className="text-sm text-[var(--muted)]">{ui.unavailable}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {invoiceEligible && finalInvoiceAllowed ? (
        <div className="mt-4">
          <a
            href={`/orders/${orderId}/invoice`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline"
          >
            {ui.orderSummary}
          </a>
        </div>
      ) : null}
    </section>
  );
}
