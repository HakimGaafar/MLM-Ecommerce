"use client";

import { useId } from "react";
import AppOverlay from "@/components/ui/AppOverlay";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirming = false,
  confirmingLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmingLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const messageId = useId();

  return (
    <AppOverlay
      open={open}
      onClose={confirming ? undefined : onCancel}
      closeOnBackdrop={!confirming}
      panelSize="content"
      panelClassName="max-w-md p-6"
      role="alertdialog"
      ariaLabelledBy={titleId}
      ariaDescribedBy={messageId}
      zIndex={200}
    >
      <h2 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
        {title}
      </h2>
      <p id={messageId} className="mt-2 text-sm text-[var(--muted)]">
        {message}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={confirming}
          onClick={onCancel}
          className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))] disabled:opacity-50 dark:hover:bg-[color-mix(in_srgb,var(--foreground)_8%,var(--surface))]"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={confirming}
          onClick={onConfirm}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {confirming ? (confirmingLabel ?? confirmLabel) : confirmLabel}
        </button>
      </div>
    </AppOverlay>
  );
}
