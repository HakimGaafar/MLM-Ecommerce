"use client";

import { FormEvent, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { LocalizedFieldError, useLiveCopy, useLiveLocale } from "@/components/ui/live-i18n";
import { inputClassName, isValidEmail } from "@/lib/field-validation";

type ErrorKey = "required" | "invalidEmail";

export default function ForgotPasswordForm({ initialLocale }: { initialLocale: "en" | "ar" }) {
  const locale = useLiveLocale();
  const ui = useLiveCopy("forgotPassword");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<ErrorKey | null>(null);
  const toast = useToast();

  void initialLocale;

  function validate(value = email): ErrorKey | null {
    if (!value.trim()) return "required";
    return isValidEmail(value) ? null : "invalidEmail";
  }

  function showFieldError(value?: string) {
    const key = validate(value);
    setFieldError(key);
    return key;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (showFieldError()) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (response.status === 429) {
        throw new Error(ui.rateLimited);
      }
      if (!response.ok) {
        throw new Error(payload?.error ?? ui.requestFailed);
      }
      const message = payload?.message ?? ui.successMessage;
      setSuccess(message);
      toast.success(message);
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : ui.requestFailed;
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

        {success ? (
          <div className="mt-6 space-y-4">
            <p className="app-alert-success" role="status">
              {success}
            </p>
            <a href="/login" className="btn-primary btn-press inline-flex w-full justify-center">
              {ui.backToLogin}
            </a>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="email">
                {ui.email}
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                className={inputClassName(Boolean(fieldError))}
                value={email}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? "forgot-email-error" : undefined}
                dir="ltr"
                onChange={(event) => {
                  const next = event.target.value;
                  setEmail(next);
                  if (fieldError) showFieldError(next);
                }}
                onBlur={() => showFieldError()}
              />
              <LocalizedFieldError
                id="forgot-email-error"
                message={fieldError ? ui[fieldError] : null}
              />
            </div>

            {error ? <p className="app-alert-error">{error}</p> : null}

            <button type="submit" disabled={isLoading} className="btn-primary btn-press w-full">
              {isLoading ? ui.submitting : ui.submit}
            </button>
          </form>
        )}

        {!success ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            <a href="/login" className="text-link font-medium">
              {ui.backToLogin}
            </a>
          </p>
        ) : null}
      </section>
    </main>
  );
}
