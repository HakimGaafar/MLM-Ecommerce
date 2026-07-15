"use client";

import { FormEvent, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";

import { isMarketConfirmed, markMarketConfirmed } from "@/lib/market-client";

type MeResponse = {
  roles?: string[];
  hasVendorStore?: boolean;
};

type SupportedLanguage = "en" | "ar";
const I18N = { en: en.login, ar: ar.login } as const;

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

export default function LoginForm({ initialLocale }: { initialLocale: SupportedLanguage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ui = I18N[initialLocale];
  const toastDict = initialLocale === "ar" ? ar.toast : en.toast;
  const toast = useToast();
  const direction = initialLocale === "ar" ? "rtl" : "ltr";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
        throw new Error(payload?.error ?? ui.loginFailed);
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-16 animate-page-enter" dir={direction}>
      <section className="app-card w-full p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{ui.title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">
              {ui.email}
            </label>
            <input
              id="email"
              type="email"
              required
              className="app-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">
              {ui.password}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              className="app-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? (
            <p className="app-alert-error">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary btn-press w-full"
          >
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
