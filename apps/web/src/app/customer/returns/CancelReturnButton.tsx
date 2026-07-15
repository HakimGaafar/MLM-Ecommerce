"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

const NO_CANCEL: string[] = ["REFUND_COMPLETED", "CANCELLED_BY_CUSTOMER", "PROCESSING_REJECTED"];

export default function CancelReturnButton({
  returnId,
  status,
  locale,
  labels,
}: {
  returnId: string;
  status: string;
  locale: Locale;
  labels: {
    cancel: string;
    cancelling: string;
    cancelError: string;
    cancelled: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);

  if (NO_CANCEL.includes(localStatus)) {
    return null;
  }

  const direction = locale === "ar" ? "rtl" : "ltr";

  async function onCancel() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/customer/returns/${encodeURIComponent(returnId)}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? labels.cancelError);
      }
      setLocalStatus("CANCELLED_BY_CUSTOMER");
      setSuccess(true);
      toast.success(toastDict.returnCancelled);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : labels.cancelError;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6" dir={direction}>
      {success ? <p className="mb-2 text-sm text-emerald-700 dark:text-emerald-400">{labels.cancelled}</p> : null}
      {error ? <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button
        type="button"
        disabled={busy || success}
        onClick={() => void onCancel()}
        className="inline-flex rounded-lg border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] px-4 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] disabled:opacity-60"
      >
        {busy ? labels.cancelling : labels.cancel}
      </button>
    </div>
  );
}
