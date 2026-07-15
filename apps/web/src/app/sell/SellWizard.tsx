"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";
type Step = 1 | 2 | 3 | "done";

type Ui = {
  stepAccount: string;
  stepStore: string;
  stepPlan: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  storeName: string;
  storeSlug: string;
  storeSlugHint: string;
  slugAvailable: string;
  slugTaken: string;
  slugInvalid: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  state: string;
  city: string;
  postalCode: string;
  about: string;
  planTitle: string;
  planDescription: string;
  planFeature1: string;
  planFeature2: string;
  planFeature3: string;
  acceptPlan: string;
  back: string;
  next: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successBody: string;
  goToLogin: string;
  existingAccount: string;
  signIn: string;
  loggedInTitle: string;
  loggedInSubtitle: string;
  errorGeneric: string;
  countrySA: string;
  countryAE: string;
  countryOM: string;
};

export default function SellWizard({
  locale,
  ui,
  mode,
}: {
  locale: Locale;
  ui: Ui;
  mode: "guest" | "loggedIn";
}) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [step, setStep] = useState<Step>(mode === "loggedIn" ? 2 : 1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "ok" | "bad">("idle");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [countryCode, setCountryCode] = useState("SA");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [about, setAbout] = useState("");
  const [acceptPlan, setAcceptPlan] = useState(false);

  const checkSlug = useCallback(
    async (nextSlug: string, nextStoreName: string) => {
      const q = new URLSearchParams();
      if (nextSlug) q.set("slug", nextSlug);
      if (nextStoreName) q.set("storeName", nextStoreName);
      const res = await fetch(`/api/v1/public/seller/check-slug?${q}`, { cache: "no-store" });
      if (!res.ok) {
        setSlugStatus("bad");
        return;
      }
      const data = (await res.json()) as { available: boolean; suggestion?: string };
      setSlugStatus(data.available ? "ok" : "bad");
      if (!nextSlug && data.suggestion) setSlug(data.suggestion);
    },
    [],
  );

  useEffect(() => {
    if (step !== 2 || !storeName.trim()) return;
    const t = setTimeout(() => void checkSlug(slug, storeName), 400);
    return () => clearTimeout(t);
  }, [step, slug, storeName, checkSlug]);

  const storePayload = () => ({
    storeName,
    slug,
    countryCode,
    addressLine1,
    addressLine2: addressLine2 || undefined,
    state: state || undefined,
    city,
    postalCode,
    about: about || undefined,
    planCode: "FREE" as const,
  });

  async function submitStoreOnly(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/seller/store", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storePayload()),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.errorGeneric);
      }
      setStep("done");
      toast.success(toastDict.storeCreated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.errorGeneric;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function submitFull(e: FormEvent) {
    e.preventDefault();
    if (!acceptPlan) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/seller/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          confirmPassword,
          acceptPlan: true,
          ...storePayload(),
        }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.errorGeneric);
      }
      setStep("done");
      toast.success(toastDict.onboardingComplete);
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.errorGeneric;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <div className="app-callout-success mt-8 p-8" dir={direction}>
        <h2 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">{ui.successTitle}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{ui.successBody}</p>
        <Link href="/login" className="mt-6 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
          {ui.goToLogin}
        </Link>
      </div>
    );
  }

  const inputClass =
    "app-input border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] dark:border-[var(--border-strong)]";

  return (
    <div className="mt-8" dir={direction}>
      {mode === "loggedIn" ? (
        <div className="mb-6 rounded-lg border border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--primary)_9%,var(--surface))] p-4 dark:bg-[color-mix(in_srgb,var(--primary)_14%,var(--surface))]">
          <h2 className="font-semibold">{ui.loggedInTitle}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.loggedInSubtitle}</p>
        </div>
      ) : null}

      <ol className="mb-8 flex flex-wrap gap-4 text-sm font-medium">
        {mode === "guest" ? (
          <li className={step === 1 ? "text-[var(--primary)]" : "text-[var(--muted)]"}>1. {ui.stepAccount}</li>
        ) : null}
        <li className={step === 2 ? "text-[var(--primary)]" : "text-[var(--muted)]"}>
          {mode === "guest" ? "2" : "1"}. {ui.stepStore}
        </li>
        <li className={step === 3 ? "text-[var(--primary)]" : "text-[var(--muted)]"}>
          {mode === "guest" ? "3" : "2"}. {ui.stepPlan}
        </li>
      </ol>

      {error ? <p className="mb-4 app-alert-error">{error}</p> : null}

      {step === 1 && mode === "guest" ? (
        <form
          className="mx-auto max-w-md space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (password !== confirmPassword) {
              setError(ui.confirmPassword);
              return;
            }
            setStep(2);
          }}
        >
          <label className="block text-sm font-medium">{ui.fullName}</label>
          <input className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
          <label className="block text-sm font-medium">{ui.email}</label>
          <input type="email" className={inputClass} required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="block text-sm font-medium">{ui.password}</label>
          <input type="password" className={inputClass} required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="block text-sm font-medium">{ui.confirmPassword}</label>
          <input type="password" className={inputClass} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <p className="text-sm text-[var(--muted)]">
            {ui.existingAccount}{" "}
            <Link href="/login" className="text-link underline">
              {ui.signIn}
            </Link>
          </p>
          <button type="submit" className="btn-primary w-full rounded-lg py-2 text-sm font-medium">
            {ui.next}
          </button>
        </form>
      ) : null}

      {step === 2 ? (
        <form className="mx-auto max-w-lg space-y-4" onSubmit={mode === "loggedIn" ? submitStoreOnly : (e) => { e.preventDefault(); setStep(3); }}>
          <label className="block text-sm font-medium">{ui.storeName}</label>
          <input className={inputClass} required value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          <label className="block text-sm font-medium">{ui.storeSlug}</label>
          <div className="flex gap-2">
            <span className="shrink-0 rounded-lg border border-[var(--border-strong)] px-2 py-2 text-sm text-[var(--muted)]">/stores/</span>
            <input className={inputClass} required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          </div>
          <p className="text-xs text-[var(--muted)]">
            {ui.storeSlugHint.replace("{slug}", slug || "…")}{" "}
            {slugStatus === "ok" ? <span className="text-emerald-600">{ui.slugAvailable}</span> : null}
            {slugStatus === "bad" ? <span className="text-red-600">{ui.slugTaken}</span> : null}
          </p>
          <label className="block text-sm font-medium">{ui.country}</label>
          <select className={inputClass} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
            <option value="SA">{ui.countrySA}</option>
            <option value="AE">{ui.countryAE}</option>
            <option value="OM">{ui.countryOM}</option>
          </select>
          <label className="block text-sm font-medium">{ui.addressLine1}</label>
          <input className={inputClass} required value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          <label className="block text-sm font-medium">{ui.addressLine2}</label>
          <input className={inputClass} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
          <label className="block text-sm font-medium">{ui.state}</label>
          <input className={inputClass} value={state} onChange={(e) => setState(e.target.value)} />
          <label className="block text-sm font-medium">{ui.city}</label>
          <input className={inputClass} required value={city} onChange={(e) => setCity(e.target.value)} />
          <label className="block text-sm font-medium">{ui.postalCode}</label>
          <input className={inputClass} required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          <label className="block text-sm font-medium">{ui.about}</label>
          <textarea className={inputClass} rows={3} value={about} onChange={(e) => setAbout(e.target.value)} />
          <div className="flex gap-3">
            {mode === "guest" ? (
              <button type="button" onClick={() => setStep(1)} className="rounded-lg border px-4 py-2 text-sm">
                {ui.back}
              </button>
            ) : null}
            <button type="submit" disabled={slugStatus === "bad"} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              {ui.next}
            </button>
          </div>
        </form>
      ) : null}

      {step === 3 && mode === "guest" ? (
        <form className="mx-auto max-w-md space-y-4" onSubmit={submitFull}>
          <div className="rounded-xl border border-[var(--border)] p-5">
            <h3 className="font-semibold">{ui.planTitle}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{ui.planDescription}</p>
            <ul className="mt-3 list-inside list-disc text-sm text-[var(--foreground)]">
              <li>{ui.planFeature1}</li>
              <li>{ui.planFeature2}</li>
              <li>{ui.planFeature3}</li>
            </ul>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" required checked={acceptPlan} onChange={(e) => setAcceptPlan(e.target.checked)} className="mt-1" />
            {ui.acceptPlan}
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="rounded-lg border px-4 py-2 text-sm">
              {ui.back}
            </button>
            <button type="submit" disabled={loading} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              {loading ? ui.submitting : ui.submit}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

