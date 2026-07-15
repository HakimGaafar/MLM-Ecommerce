"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import AppOverlay from "@/components/ui/AppOverlay";

export default function RejectReasonDialog({
  open,
  title,
  description,
  subjectName,
  reasonLabel,
  reasonPlaceholder,
  reasonRequired,
  confirmLabel,
  cancelLabel,
  confirming = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  subjectName?: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  reasonRequired: string;
  confirmLabel: string;
  cancelLabel: string;
  confirming?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(reasonRequired);
      return;
    }
    setError(null);
    onConfirm(trimmed);
  }

  return (
    <AppOverlay
      open={open}
      onClose={confirming ? undefined : onCancel}
      closeOnBackdrop={!confirming}
      panelSize="content"
      panelClassName="max-w-md w-full"
      role="dialog"
      ariaLabelledBy={titleId}
      ariaDescribedBy={descId}
      zIndex={200}
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface-elevated))] px-6 py-5">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          <p id={descId} className="mt-1 text-sm text-[var(--muted)]">
            {description}
          </p>
          {subjectName ? (
            <p className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)]">
              {subjectName}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 px-6 py-5">
          <label className="block space-y-2 text-sm" htmlFor="reject-reason">
            <span className="font-medium text-[var(--foreground)]">{reasonLabel}</span>
            <textarea
              id="reject-reason"
              className="app-input min-h-28 w-full resize-y"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder={reasonPlaceholder}
              maxLength={2000}
              disabled={confirming}
              autoFocus
            />
          </label>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))] disabled:opacity-50 dark:hover:bg-[color-mix(in_srgb,var(--foreground)_8%,var(--surface))]"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={confirming}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </AppOverlay>
  );
}
