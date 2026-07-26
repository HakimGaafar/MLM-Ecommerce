"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/toast/ToastProvider";
import { LocalizedFieldError, useLiveCopy, useLiveLocale } from "@/components/ui/live-i18n";
import PasswordInput from "@/components/ui/PasswordInput";
import { isStrongPassword } from "@/lib/field-validation";

type FieldKey = "password" | "confirm";
type ErrorKey = "required" | "invalidPassword" | "mismatch";

export default function ResetPasswordForm({ initialLocale }: { initialLocale: "en" | "ar" }) {
  const locale = useLiveLocale();
  const ui = useLiveCopy("resetPassword");
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, ErrorKey>>>({});
  const toast = useToast();

  void initialLocale;

  useEffect(() => {
    if (!token) {
      window.location.replace("/forgot-password");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/auth/reset-password?token=${encodeURIComponent(token)}`,
          { credentials: "include", cache: "no-store" },
        );
        const data = (await res.json().catch(() => null)) as { valid?: boolean } | null;
        if (!cancelled) setTokenValid(Boolean(data?.valid));
      } catch {
        if (!cancelled) setTokenValid(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function validateField(field: FieldKey, value?: string): ErrorKey | null {
    if (field === "password") {
      const v = value ?? password;
      if (!v) return "required";
      return isStrongPassword(v) ? null : "invalidPassword";
    }
    const v = value ?? confirm;
    if (!v) return "required";
    return v === password ? null : "mismatch";
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

  function validateAll() {
    const next: Partial<Record<FieldKey, ErrorKey>> = {};
    const passwordError = validateField("password");
    const confirmError = validateField("confirm");
    if (passwordError) next.password = passwordError;
    if (confirmError) next.confirm = confirmError;
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!validateAll()) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 429) throw new Error(ui.rateLimited);
      if (!response.ok) {
        const msg = payload?.error ?? ui.resetFailed;
        if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired")) {
          setTokenValid(false);
        }
        throw new Error(msg);
      }
      setSuccess(true);
      toast.success(ui.successMessage);
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : ui.resetFailed;
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-16 animate-page-enter"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <section className="app-card w-full p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{ui.title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>

        {checking ? (
          <p className="mt-6 text-sm text-[var(--muted)]">{ui.checkingLink}</p>
        ) : success ? (
          <div className="mt-6 space-y-4">
            <p className="app-alert-success" role="status">
              {ui.successMessage}
            </p>
            <a href="/login" className="btn-primary btn-press inline-flex w-full justify-center">
              {ui.goToLogin}
            </a>
          </div>
        ) : tokenValid === false ? (
          <div className="mt-6 space-y-4">
            <p className="app-alert-error" role="alert">
              {ui.invalidLink}
            </p>
            <a
              href="/forgot-password"
              className="btn-primary btn-press inline-flex w-full justify-center"
            >
              {ui.requestNewLink}
            </a>
            <p className="text-sm text-[var(--muted)]">
              <a href="/login" className="text-link font-medium">
                {ui.backToLogin}
              </a>
            </p>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="password">
                {ui.newPassword}
              </label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                required
                maxLength={128}
                hasError={Boolean(fieldErrors.password)}
                value={password}
                showLabel={ui.showPassword}
                hideLabel={ui.hidePassword}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password ? "reset-password-error" : "reset-password-hint"
                }
                onChange={(event) => {
                  const next = event.target.value;
                  setPassword(next);
                  if (fieldErrors.password) showFieldError("password", next);
                  if (fieldErrors.confirm && confirm) showFieldError("confirm", confirm);
                }}
                onBlur={() => showFieldError("password")}
              />
              <p id="reset-password-hint" className="text-xs text-[var(--muted)]">
                {ui.passwordHint}
              </p>
              <LocalizedFieldError
                id="reset-password-error"
                message={
                  fieldErrors.password
                    ? fieldErrors.password === "invalidPassword"
                      ? ui.invalidPassword
                      : ui.required
                    : null
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="confirm">
                {ui.confirmPassword}
              </label>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                required
                maxLength={128}
                hasError={Boolean(fieldErrors.confirm)}
                value={confirm}
                showLabel={ui.showPassword}
                hideLabel={ui.hidePassword}
                aria-invalid={Boolean(fieldErrors.confirm)}
                aria-describedby={fieldErrors.confirm ? "reset-confirm-error" : undefined}
                onChange={(event) => {
                  const next = event.target.value;
                  setConfirm(next);
                  if (fieldErrors.confirm) showFieldError("confirm", next);
                }}
                onBlur={() => showFieldError("confirm")}
              />
              <LocalizedFieldError
                id="reset-confirm-error"
                message={
                  fieldErrors.confirm
                    ? fieldErrors.confirm === "mismatch"
                      ? ui.mismatch
                      : ui.required
                    : null
                }
              />
            </div>

            {error ? <p className="app-alert-error">{error}</p> : null}

            <button type="submit" disabled={isLoading} className="btn-primary btn-press w-full">
              {isLoading ? ui.submitting : ui.submit}
            </button>

            <p className="text-sm text-[var(--muted)]">
              <a href="/login" className="text-link font-medium">
                {ui.backToLogin}
              </a>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
