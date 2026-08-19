"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveCopy } from "@/components/ui/live-i18n";
import LoginForm from "@/app/login/LoginForm";
import RegisterForm from "@/app/register/RegisterForm";

export default function CustomerAccountPanel({
  initialLocale,
  initialReferralCode,
}: {
  initialLocale: "en" | "ar";
  initialReferralCode?: string;
}) {
  const ui = useLiveCopy("accountPortal").customer;
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "register" ? "register" : "login";

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
        <Link
          href="/account/customer"
          className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition ${
            mode === "login"
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {ui.tabLogin}
        </Link>
        <Link
          href="/account/customer?mode=register"
          className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition ${
            mode === "register"
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {ui.tabRegister}
        </Link>
      </div>

      {mode === "login" ? (
        <LoginForm initialLocale={initialLocale} embedded returnTo="/dashboard" />
      ) : (
        <RegisterForm initialLocale={initialLocale} initialReferralCode={initialReferralCode} embedded />
      )}
    </div>
  );
}
