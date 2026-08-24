"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";

export default function FooterCustomerAccount({
  label,
  controlPanelLabel,
  logoutLabel,
  isLoggedIn,
}: {
  label: string;
  controlPanelLabel: string;
  logoutLabel: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const locale = useAppLocale();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement | null>(null);
  const direction = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    toast.success(toastDict.loggedOut);
    router.replace("/");
    router.refresh();
  }

  if (!isLoggedIn) {
    return (
      <Link href="/account/customer" className="font-medium text-[var(--primary)] transition hover:underline">
        {label}
      </Link>
    );
  }

  return (
    <span className="relative inline-flex" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-medium text-[var(--primary)] transition hover:underline"
        aria-expanded={open}
      >
        {label}
      </button>
      {open ? (
        <div
          className="absolute bottom-full z-50 mb-2 min-w-44 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-lg"
          style={locale === "ar" ? { left: 0 } : { right: 0 }}
          dir={direction}
        >
          <Link
            href="/dashboard"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
            onClick={() => setOpen(false)}
          >
            {controlPanelLabel}
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="block w-full rounded-lg px-3 py-2 text-start text-sm text-red-600 hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] dark:text-red-400"
          >
            {logoutLabel}
          </button>
        </div>
      ) : null}
    </span>
  );
}
