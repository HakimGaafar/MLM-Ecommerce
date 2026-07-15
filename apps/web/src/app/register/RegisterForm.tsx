"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";

type AccountType = "CUSTOMER" | "VENDOR" | "BOTH";
type SupportedLanguage = "en" | "ar";
const I18N = { en: en.register, ar: ar.register } as const;

function normalizeReferralCode(code?: string) {
  const cleaned = code?.trim().toUpperCase();
  if (!cleaned) return "";
  return /^[A-Z0-9]{4,24}$/.test(cleaned) ? cleaned : "";
}

export default function RegisterForm({
  initialLocale,
  initialReferralCode,
}: {
  initialLocale: SupportedLanguage;
  initialReferralCode?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const toastDict = getToastDict(initialLocale);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("CUSTOMER");
  const [referralCode, setReferralCode] = useState(normalizeReferralCode(initialReferralCode));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const ui = I18N[initialLocale];
  const direction = initialLocale === "ar" ? "rtl" : "ltr";
  const accountTypeOptions: Array<{ value: AccountType; label: string; hint: string }> = [
    {
      value: "CUSTOMER",
      label: ui.accountTypeCustomerLabel,
      hint: ui.accountTypeCustomerHint,
    },
    {
      value: "VENDOR",
      label: ui.accountTypeVendorLabel,
      hint: ui.accountTypeVendorHint,
    },
    {
      value: "BOTH",
      label: ui.accountTypeBothLabel,
      hint: ui.accountTypeBothHint,
    },
  ];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          accountType,
          referralCode: referralCode.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string | { fieldErrors?: Record<string, string[]> } }
          | null;
        if (typeof payload?.error === "string") {
          throw new Error(payload.error);
        }
        throw new Error(ui.registrationFailedInput);
      }

      const needsStoreSetup = accountType === "VENDOR" || accountType === "BOTH";
      const successMsg = needsStoreSetup ? ui.registrationSuccessVendor : ui.registrationSuccess;
      setSuccess(successMsg);
      toast.success(toastDict.registered);
      setTimeout(
        () => router.push("/login"),
        700,
      );
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : ui.registrationFailed;
      setError(msg);
      toast.error(msg || toastDict.registerFailed);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-16 animate-page-enter" dir={direction}>
      <section className="app-card w-full p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{ui.title}</h1>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="name">
              {ui.fullName}
            </label>
            <input
              id="name"
              type="text"
              required
              minLength={2}
              maxLength={80}
              pattern="^[A-Za-z0-9 .'-]{2,80}$"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="app-input"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">
              {ui.email}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="app-input"
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="app-input"
            />
            <p className="text-xs text-[var(--muted)]">{ui.passwordHint}</p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">{ui.accountType}</span>
            <div className="space-y-2">
              {accountTypeOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="accountType"
                    value={option.value}
                    checked={accountType === option.value}
                    onChange={() => setAccountType(option.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <span className="block text-[var(--muted)]">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="referralCode">
              {ui.referralCode}
            </label>
            <input
              id="referralCode"
              type="text"
              pattern="^[A-Za-z0-9]{4,24}$"
              maxLength={24}
              value={referralCode}
              onChange={(event) => setReferralCode(event.target.value)}
              placeholder={ui.referralPlaceholder}
              className="app-input uppercase"
            />
          </div>

          {error ? (
            <p className="app-alert-error">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="app-callout-success">
              {success}
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
          {ui.alreadyHaveAccount}{" "}
          <a href="/login" className="font-medium underline">
            {ui.signIn}
          </a>
        </p>
      </section>
    </main>
  );
}
