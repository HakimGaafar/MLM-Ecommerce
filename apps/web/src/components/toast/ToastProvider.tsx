"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "success" | "warning" | "error";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
};

type ToastContextValue = {
  toast: (variant: ToastVariant, message: string) => void;
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "app-toast-success",
  warning: "app-toast-warning",
  error: "app-toast-error",
};

export function ToastProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: "en" | "ar";
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const isRtl = locale === "ar";

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev, { id, variant, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (m) => push("success", m),
      warning: (m) => push("warning", m),
      error: (m) => push("error", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className={`pointer-events-none fixed top-4 z-[100] flex max-w-sm flex-col gap-2 px-4 ${
          isRtl ? "start-4 items-start" : "end-4 items-end"
        }`}
        style={{ "--toast-from": isRtl ? "-100%" : "100%" } as React.CSSProperties}
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`animate-toast-enter pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${VARIANT_STYLES[item.variant]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span>{item.message}</span>
              <button
                type="button"
                className="shrink-0 opacity-60 hover:opacity-100"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
