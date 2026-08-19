"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast/ToastProvider";
import { LocalizedFieldError, useLiveCopy, useLiveLocale } from "@/components/ui/live-i18n";
import PasswordInput from "@/components/ui/PasswordInput";
import {
  inputClassName,
  isValidEmail,
  isValidMerchantUsername,
} from "@/lib/field-validation";
import { getToastDict } from "@/lib/toast-messages";
import { isMarketConfirmed, markMarketConfirmed } from "@/lib/market-client";

type FieldKey = "username" | "password";
type ErrorKey = "required" | "invalidUsername" | "passwordRequired";

export default function MerchantLoginPanel() {
  const locale = useLiveLocale();
  const ui = useLiveCopy("accountPortal").merchant;
  const loginUi = useLiveCopy("login");
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, ErrorKey>>>({});

  function validateField(field: FieldKey, value = field === "username" ? username : password): ErrorKey | null {
    if (field === "username") {
      if (!value.trim()) return "required";
      return isValidMerchantUsername(value) ? null : "invalidUsername";
    }
    return value ? null : "passwordRequired";
  }

  function showFieldError(field: FieldKey, value?: string) {
    const key = validateField(field, value);
    setFieldErrors((current) => {
      if (!key) {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      }
      return { ...current, [field]: key };
    });
    return key;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const nextErrors: Partial<Record<FieldKey, ErrorKey>> = {};
    const usernameError = validateField("username");
    const passwordError = validateField("password");
    if (usernameError) nextErrors.username = usernameError;
    if (passwordError) nextErrors.password = passwordError;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsLoading(true);
    try {
      const loginResponse = await fetch("/api/v1/auth/merchant/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });

      if (!loginResponse.ok) {
        throw new Error(ui.invalidCredentials);
      }

      const meResponse = await fetch("/api/v1/auth/me", { credentials: "include" });
      const mePayload = (await meResponse.json().catch(() => null)) as
        | { hasVendorStore?: boolean }
        | null;
      const target = mePayload?.hasVendorStore === false ? "/sell" : "/vendor";
      markMarketConfirmed();
      window.location.assign(isMarketConfirmed() ? target : `/market?returnTo=${encodeURIComponent(target)}`);
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
          <label className="text-sm font-medium" htmlFor="merchant-username">
            {ui.usernameLabel}
          </label>
          <input
            id="merchant-username"
            type="text"
            autoComplete="username"
            required
            maxLength={30}
            dir="ltr"
            className={inputClassName(Boolean(fieldErrors.username))}
            value={username}
            aria-invalid={Boolean(fieldErrors.username)}
            onChange={(event) => {
              const next = event.target.value;
              setUsername(next);
              if (fieldErrors.username) showFieldError("username", next);
            }}
            onBlur={() => showFieldError("username")}
          />
          <p className="text-xs text-[var(--muted)]">{ui.usernameHint}</p>
          <LocalizedFieldError
            id="merchant-username-error"
            message={
              fieldErrors.username
                ? ui[fieldErrors.username as "required" | "invalidUsername"]
                : null
            }
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="merchant-password">
            {loginUi.password}
          </label>
          <PasswordInput
            id="merchant-password"
            autoComplete="current-password"
            required
            maxLength={128}
            hasError={Boolean(fieldErrors.password)}
            showLabel={loginUi.showPassword}
            hideLabel={loginUi.hidePassword}
            value={password}
            onChange={(event) => {
              const next = event.target.value;
              setPassword(next);
              if (fieldErrors.password) showFieldError("password", next);
            }}
            onBlur={() => showFieldError("password")}
          />
          <LocalizedFieldError
            id="merchant-password-error"
            message={fieldErrors.password ? loginUi.passwordRequired : null}
          />
        </div>

        {error ? <p className="app-alert-error">{error}</p> : null}

        <button type="submit" disabled={isLoading} className="btn-primary btn-press w-full">
          {isLoading ? loginUi.submitting : ui.loginSubmit}
        </button>
      </form>

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <p className="text-sm font-medium text-[var(--foreground)]">{ui.registerTitle}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{ui.registerSubtitle}</p>
        <Link href="/sell" className="btn-secondary btn-press mt-3 inline-flex w-full justify-center">
          {ui.registerCta}
        </Link>
      </div>
    </section>
  );
}
