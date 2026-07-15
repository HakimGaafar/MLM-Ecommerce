"use client";

import { useState } from "react";
import { downloadInvoicePdf } from "@/lib/invoices/download-invoice-pdf";

export default function DownloadOrderSummaryButton({
  orderId,
  label,
  downloadingLabel,
  downloadError,
}: {
  orderId: string;
  label: string;
  downloadingLabel: string;
  downloadError: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      await downloadInvoicePdf(`/api/v1/customer/orders/${orderId}/summary-pdf`);
    } catch (downloadErr) {
      setError(downloadErr instanceof Error ? downloadErr.message : downloadError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        className="no-print btn-primary btn-press shrink-0 disabled:opacity-60"
        disabled={loading}
        onClick={() => void handleDownload()}
      >
        {loading ? downloadingLabel : label}
      </button>
      {error ? <p className="no-print text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
