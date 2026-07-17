"use client";

import { FormEvent, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { LocalizedFieldError, useLiveCopy, useLiveLocale } from "@/components/ui/live-i18n";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { inputClassName, isValidEmail } from "@/lib/field-validation";
import { isMarketConfirmed, markMarketConfirmed } from "@/lib/market-client";

type MeResponse = {
  roles?: string[];
  hasVendorStore?: boolean;
};

type FieldKey = "email" | "password";
type ErrorKey = "required" | "invalidEmail" | "passwordRequired";

function homeAfterLogin(roles: string[], needsStoreSetup: boolean) {
  if (needsStoreSetup) return "/sell";
  if (roles.includes("ADMIN") || roles.includes("VENDOR") || roles.includes("CUSTOMER")) {
    return "/dashboard";
  }
  return "/";
}

function postLoginDestination(roles: string[], needsStoreSetup: boolean): string {
  const target = homeAfterLogin(roles, needsStoreSetup);
  if (roles.includes("ADMIN")) {
    markMarketConfirmed();
    return target;
  }
  if (!isMarketConfirmed()) {
    return `/market?returnTo=${encodeURIComponent(target)}`;
  }
  return target;
}

async function resolvePostLoginRedirect(roles: string[], needsStoreSetup: boolean): Promise<string> {
  const target = homeAfterLogin(roles, needsStoreSetup);

  if (roles.includes("ADMIN")) {
    markMarketConfirmed();
    return target;
  }

  if (roles.includes("VENDOR") && !needsStoreSetup) {
    try {
      const res = await fetch("/api/v1/market/auto-resolve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: target }),
      });
      const data = (await res.json().catch(() => null)) as { redirectUrl?: string } | null;
      if (res.ok && data?.redirectUrl) {
        markMarketConfirmed();
        return data.redirectUrl;
      }
    } catch {
      /* fall through to picker */
    }
  }

  return postLoginDestination(roles, needsStoreSetup);
}

function mapLoginApiError(
  status: number,
  payloadError: string | undefined,
  ui: {
    rateLimited: string;
    invalidCredentials: string;
    loginFailed: string;
  },
) {
  if (status === 429) return ui.rateLimited;
  if (payloadError?.toLowerCase().includes("invalid")) return ui.invalidCredentials;
  return ui.loginFailed;
}

export default function LoginForm({ initialLocale }: { initialLocale: "en" | "ar" }) {
  const locale = useLiveLocale();
  const ui = useLiveCopy("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, ErrorKey>>>({});
  const toastDict = locale === "ar" ? ar.toast : en.toast;
  const toast = useToast();

  function validateField(field: FieldKey, value = field === "email" ? email : password): ErrorKey | null {
    if (field === "email") {
      if (!value.trim()) return "required";
      return isValidEmail(value) ? null : "invalidEmail";
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

  function validateAll() {
    const nextErrors: Partial<Record<FieldKey, ErrorKey>> = {};
    const emailError = validateField("email");
    const passwordError = validateField("password");
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!validateAll()) return;
    setIsLoading(true);

    try {
      const loginResponse = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        const payload = (await loginResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(mapLoginApiError(loginResponse.status, payload?.error, ui));
      }

      const meResponse = await fetch("/api/v1/auth/me", {
        credentials: "include",
      });

      const mePayload = (await meResponse.json().catch(() => null)) as MeResponse | null;
      const roles = mePayload?.roles ?? [];
      const needsStoreSetup = roles.includes("VENDOR") && mePayload?.hasVendorStore === false;
      window.location.assign(await resolvePostLoginRedirect(roles, needsStoreSetup));
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : ui.loginFailed;
      setError(msg);
      toast.error(msg || toastDict.loginFailed);
    } finally {
      setIsLoading(false);
    }
  }

  void initialLocale;

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-16 animate-page-enter"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <section className="app-card w-full p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{ui.title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>

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
              className={inputClassName(Boolean(fieldErrors.email))}
              value={email}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              dir="ltr"
              onChange={(event) => {
                const next = event.target.value;
                setEmail(next);
                if (fieldErrors.email) showFieldError("email", next);
              }}
              onBlur={() => showFieldError("email")}
            />
            <LocalizedFieldError
              id="login-email-error"
              message={fieldErrors.email ? ui[fieldErrors.email] : null}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">
              {ui.password}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              className={inputClassName(Boolean(fieldErrors.password))}
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
              onChange={(event) => {
                const next = event.target.value;
                setPassword(next);
                if (fieldErrors.password) showFieldError("password", next);
              }}
              onBlur={() => showFieldError("password")}
            />
            <LocalizedFieldError
              id="login-password-error"
              message={fieldErrors.password ? ui[fieldErrors.password] : null}
            />
          </div>

          {error ? <p className="app-alert-error">{error}</p> : null}

          <button type="submit" disabled={isLoading} className="btn-primary btn-press w-full">
            {isLoading ? ui.submitting : ui.submit}
          </button>
        </form>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {ui.needAccount}{" "}
          <a href="/register" className="text-link font-medium">
            {ui.createOne}
          </a>
        </p>
      </section>
    </main>
  );
}
