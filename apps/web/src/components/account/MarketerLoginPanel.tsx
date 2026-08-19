"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast/ToastProvider";
import { LocalizedFieldError, useLiveCopy, useLiveLocale } from "@/components/ui/live-i18n";
import PasswordInput from "@/components/ui/PasswordInput";
import { inputClassName, isValidEmail } from "@/lib/field-validation";
import { getToastDict } from "@/lib/toast-messages";
import { isMarketConfirmed, markMarketConfirmed } from "@/lib/market-client";

type MeResponse = {
  roles?: string[];
};

type FieldKey = "email" | "password";

export default function MarketerLoginPanel() {
  const locale = useLiveLocale();
  const ui = useLiveCopy("accountPortal").marketer;
  const loginUi = useLiveCopy("login");
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    if (!email.trim()) nextErrors.email = loginUi.required;
    else if (!isValidEmail(email)) nextErrors.email = loginUi.invalidEmail;
    if (!password) nextErrors.password = loginUi.passwordRequired;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsLoading(true);
    try {
      const loginResponse = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!loginResponse.ok) throw new Error(ui.invalidCredentials);

      const meResponse = await fetch("/api/v1/auth/me", { credentials: "include" });
      const mePayload = (await meResponse.json().catch(() => null)) as MeResponse | null;
      const roles = mePayload?.roles ?? [];
      if (!roles.includes("CUSTOMER")) {
        throw new Error(ui.customerAccountRequired);
      }

      const target = "/affiliate";
      markMarketConfirmed();
      window.location.assign(
        isMarketConfirmed() ? target : `/market?returnTo=${encodeURIComponent(target)}`,
      );
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : loginUi.loginFailed;
      setError(msg);
      toast.error(msg || toastDict.loginFailed);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="app-card p-6">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">{ui.loginTitle}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{ui.loginSubtitle}</p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="marketer-email">
            {loginUi.email}
          </label>
          <input
            id="marketer-email"
            type="email"
            autoComplete="email"
            dir="ltr"
            className={inputClassName(Boolean(fieldErrors.email))}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <LocalizedFieldError id="marketer-email-error" message={fieldErrors.email ?? null} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="marketer-password">
            {loginUi.password}
          </label>
          <PasswordInput
            id="marketer-password"
            autoComplete="current-password"
            hasError={Boolean(fieldErrors.password)}
            showLabel={loginUi.showPassword}
            hideLabel={loginUi.hidePassword}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <LocalizedFieldError id="marketer-password-error" message={fieldErrors.password ?? null} />
        </div>

        {error ? <p className="app-alert-error">{error}</p> : null}

        <button type="submit" disabled={isLoading} className="btn-primary btn-press w-full">
          {isLoading ? loginUi.submitting : ui.loginSubmit}
        </button>
      </form>

      <div className="mt-6 space-y-4 border-t border-[var(--border)] pt-4">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">{ui.registerTitle}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.registerSubtitle}</p>
          <Link
            href="/account/customer?mode=register"
            className="btn-secondary btn-press mt-3 inline-flex w-full justify-center"
          >
            {ui.registerCta}
          </Link>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {ui.enrolledHint}{" "}
          <Link href="/affiliate" className="text-link font-medium">
            {ui.enrolledLink}
          </Link>
        </p>
      </div>
    </section>
  );
}
