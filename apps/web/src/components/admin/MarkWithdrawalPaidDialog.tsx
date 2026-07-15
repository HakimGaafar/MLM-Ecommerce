"use client";

import { useId } from "react";
import AppOverlay from "@/components/ui/AppOverlay";

export default function MarkWithdrawalPaidDialog({
  open,
  userName,
  amount,
  currency,
  locale,
  title,
  message,
  referenceLabel,
  referencePlaceholder,
  confirmLabel,
  cancelLabel,
  confirming,
  confirmingLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  userName: string;
  amount: string;
  currency: string;
  locale: "en" | "ar";
  title: string;
  message: string;
  referenceLabel: string;
  referencePlaceholder: string;
  confirmLabel: string;
  cancelLabel: string;
  confirming?: boolean;
  confirmingLabel?: string;
  onConfirm: (bankReference: string) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const referenceId = useId();

  return (
    <AppOverlay
      open={open}
      onClose={confirming ? undefined : onCancel}
      closeOnBackdrop={!confirming}
      panelSize="content"
      panelClassName="max-w-md p-6"
      role="dialog"
      ariaLabelledBy={titleId}
      ariaDescribedBy={messageId}
      zIndex={200}
    >
      <h2 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
        {title}
      </h2>
      <p id={messageId} className="mt-2 text-sm text-[var(--muted)]">
        {message.replace("{user}", userName).replace("{amount}", amount).replace("{currency}", currency)}
      </p>
      <label htmlFor={referenceId} className="mt-4 block text-sm">
        <span className="text-[var(--muted)]">{referenceLabel}</span>
        <input
          id={referenceId}
          name="bankReference"
          type="text"
          maxLength={120}
          placeholder={referencePlaceholder}
          disabled={confirming}
          className="mt-1 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)]"
          dir={locale === "ar" ? "rtl" : "ltr"}
        />
      </label>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={confirming}
          onClick={onCancel}
          className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))] disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={confirming}
          onClick={() => {
            const input = document.getElementById(referenceId) as HTMLInputElement | null;
            onConfirm(input?.value.trim() ?? "");
          }}
          className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {confirming ? (confirmingLabel ?? confirmLabel) : confirmLabel}
        </button>
      </div>
    </AppOverlay>
  );
}
