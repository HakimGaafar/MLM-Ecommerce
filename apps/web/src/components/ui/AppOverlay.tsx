"use client";

import { useEffect, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";

export type AppOverlayPanelSize = "viewport" | "content";

/**
 * Full-viewport overlay (portaled to `document.body`).
 * Backdrop is theme-aware; panel is centered at up to 80% of the viewport.
 */
export default function AppOverlay({
  open,
  onClose,
  children,
  closeOnBackdrop = true,
  variant = "panel",
  panelSize = "viewport",
  panelClassName = "",
  zIndex = 200,
  role = "dialog",
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  dialogRef,
  backdropLabel,
}: {
  open: boolean;
  onClose?: () => void;
  children?: ReactNode;
  closeOnBackdrop?: boolean;
  /** `backdrop` = dim full page only (e.g. mobile nav). `panel` = centered panel. */
  variant?: "panel" | "backdrop";
  panelSize?: AppOverlayPanelSize;
  panelClassName?: string;
  zIndex?: number;
  role?: "dialog" | "alertdialog";
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  dialogRef?: Ref<HTMLDivElement>;
  backdropLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const panelSizeClass =
    panelSize === "viewport"
      ? "h-[80vh] w-[80vw] max-h-[80vh] max-w-[80vw]"
      : "max-h-[80vh] max-w-[80vw] w-full";

  if (variant === "backdrop") {
    return createPortal(
      <button
        type="button"
        className="app-overlay-backdrop modal-backdrop-enter fixed inset-0 cursor-default"
        style={{ zIndex }}
        onClick={onClose}
        aria-label={backdropLabel ?? "Close"}
      />,
      document.body,
    );
  }

  return createPortal(
    <div
      className="app-overlay-backdrop modal-backdrop-enter fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex }}
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={`app-overlay-panel modal-panel-enter relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-md)] outline-none ${panelSizeClass} ${panelClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
