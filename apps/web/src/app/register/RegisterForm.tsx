"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast/ToastProvider";
import { LocalizedFieldError, useLiveCopy, useLiveLocale } from "@/components/ui/live-i18n";
import {
  inputClassName,
  isStrongPassword,
  isValidEmail,
  REFERRAL_CODE_PATTERN,
  REGISTER_NAME_PATTERN,
} from "@/lib/field-validation";
import { getToastDict } from "@/lib/toast-messages";

type AccountType = "CUSTOMER" | "VENDOR" | "BOTH";
type FieldKey = "name" | "email" | "password" | "referralCode";
type ErrorKey =
  | "required"
  | "invalidName"
  | "invalidEmail"
  | "invalidPassword"
  | "invalidReferral";

function normalizeReferralCode(code?: string) {
  const cleaned = code?.trim().toUpperCase();
  if (!cleaned) return "";
  return /^[A-Z0-9]{4,24}$/.test(cleaned) ? cleaned : "";
}

function mapRegisterApiError(
  status: number,
  payloadError: string | undefined,
  ui: {
    rateLimited: string;
    emailInUse: string;
    invalidPassword: string;
    invalidName: string;
    invalidEmail: string;
    registrationFailedInput: string;
  },
) {
  if (status === 429) return ui.rateLimited;
  if (payloadError?.toLowerCase().includes("already in use")) return ui.emailInUse;
  if (payloadError?.toLowerCase().includes("password")) return ui.invalidPassword;
  if (payloadError?.toLowerCase().includes("name")) return ui.invalidName;
  if (payloadError?.toLowerCase().includes("email")) return ui.invalidEmail;
  return ui.registrationFailedInput;
}

export default function RegisterForm({
  initialLocale,
  initialReferralCode,
}: {
  initialLocale: "en" | "ar";
  initialReferralCode?: string;
}) {
  const locale = useLiveLocale();
  const ui = useLiveCopy("register");
  void initialLocale;
  const router = useRouter();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("CUSTOMER");
  const [referralCode, setReferralCode] = useState(normalizeReferralCode(initialReferralCode));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, ErrorKey>>>({});

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

  function fieldValue(field: FieldKey) {
    if (field === "name") return name;
    if (field === "email") return email;
    if (field === "password") return password;
    return referralCode;
  }

  function validateField(field: FieldKey, value = fieldValue(field)): ErrorKey | null {
    const trimmed = value.trim();

    if (field === "name") {
      if (!trimmed) return "required";
      return REGISTER_NAME_PATTERN.test(trimmed) ? null : "invalidName";
    }

    if (field === "email") {
      if (!trimmed) return "required";
      return isValidEmail(trimmed) ? null : "invalidEmail";
    }

    if (field === "password") {
      if (!value) return "required";
      return isStrongPassword(value) ? null : "invalidPassword";
    }

    if (!trimmed) return null;
    return REFERRAL_CODE_PATTERN.test(trimmed) ? null : "invalidReferral";
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
    (["name", "email", "password", "referralCode"] as const).forEach((field) => {
      const key = validateField(field);
      if (key) nextErrors[field] = key;
    });
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!validateAll()) return;
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
        const payloadError = typeof payload?.error === "string" ? payload.error : undefined;
        throw new Error(mapRegisterApiError(response.status, payloadError, ui));
      }

      const needsStoreSetup = accountType === "VENDOR" || accountType === "BOTH";
      const successMsg = needsStoreSetup ? ui.registrationSuccessVendor : ui.registrationSuccess;
      setSuccess(successMsg);
      toast.success(toastDict.registered);
      setTimeout(() => router.push("/login"), 700);
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : ui.registrationFailed;
      setError(msg);
      toast.error(msg || toastDict.registerFailed);
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

        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="name">
              {ui.fullName}
            </label>
            <input
              id="name"
              type="text"
              required
              maxLength={80}
              autoComplete="name"
              value={name}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "register-name-error" : undefined}
              onChange={(event) => {
                const next = event.target.value;
                setName(next);
                if (fieldErrors.name) showFieldError("name", next);
              }}
              onBlur={() => showFieldError("name")}
              className={inputClassName(Boolean(fieldErrors.name))}
            />
            <LocalizedFieldError
              id="register-name-error"
              message={fieldErrors.name ? ui[fieldErrors.name] : null}
            />
          </div>

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
              maxLength={254}
              value={email}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
              dir="ltr"
              onChange={(event) => {
                const next = event.target.value;
                setEmail(next);
                if (fieldErrors.email) showFieldError("email", next);
              }}
              onBlur={() => showFieldError("email")}
              className={inputClassName(Boolean(fieldErrors.email))}
            />
            <LocalizedFieldError
              id="register-email-error"
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
              autoComplete="new-password"
              required
              maxLength={128}
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? "register-password-error" : "register-password-hint"
              }
              onChange={(event) => {
                const next = event.target.value;
                setPassword(next);
                if (fieldErrors.password) showFieldError("password", next);
              }}
              onBlur={() => showFieldError("password")}
              className={inputClassName(Boolean(fieldErrors.password))}
            />
            <LocalizedFieldError
              id="register-password-error"
              message={fieldErrors.password ? ui[fieldErrors.password] : null}
            />
            {!fieldErrors.password ? (
              <p id="register-password-hint" className="text-xs text-[var(--muted)]">
                {ui.passwordHint}
              </p>
            ) : null}
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
              maxLength={24}
              value={referralCode}
              aria-invalid={Boolean(fieldErrors.referralCode)}
              aria-describedby={fieldErrors.referralCode ? "register-referral-error" : undefined}
              onChange={(event) => {
                const next = event.target.value;
                setReferralCode(next);
                if (fieldErrors.referralCode) showFieldError("referralCode", next);
              }}
              onBlur={() => showFieldError("referralCode")}
              placeholder={ui.referralPlaceholder}
              className={inputClassName(Boolean(fieldErrors.referralCode), "uppercase")}
            />
            <LocalizedFieldError
              id="register-referral-error"
              message={fieldErrors.referralCode ? ui[fieldErrors.referralCode] : null}
            />
          </div>

          {error ? <p className="app-alert-error">{error}</p> : null}

          {success ? <p className="app-callout-success">{success}</p> : null}

          <button type="submit" disabled={isLoading} className="btn-primary btn-press w-full">
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
