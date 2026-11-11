"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import { useToast } from "@/components/toast/ToastProvider";
import { useLiveCopy, useLiveLocale } from "@/components/ui/live-i18n";
import { inputClassName, isStrongPassword, isValidEmail, isValidMerchantUsername } from "@/lib/field-validation";
import { mapsUrlFromLatLng, reverseGeocodeLatLng } from "@/lib/reverse-geocode";
import { getToastDict } from "@/lib/toast-messages";
import {
  isAddressCountryCode,
  legalDocumentHref,
  LEGAL_DOCUMENT_TITLES,
  MERCHANT_REGISTRATION_DOCUMENT_TYPES,
  primaryMarketFromCountry,
  type AddressCountryCode,
  type LegalDocumentType,
} from "@mlm/shared";

const AddressMapPicker = dynamic(() => import("@/components/address/AddressMapPicker"), {
  ssr: false,
  loading: () => <p className="text-xs text-[var(--muted)]">Loading map…</p>,
});

type Locale = "en" | "ar";
type Step = 1 | 2 | 3 | 4 | 5 | 6 | "done" | "under_review";

const STEPS: { key: Step; labelKey: string }[] = [
  { key: 1, labelKey: "stepAccount" },
  { key: 2, labelKey: "stepPersonal" },
  { key: 3, labelKey: "stepLegal" },
  { key: 4, labelKey: "stepStore" },
  { key: 5, labelKey: "stepFinancial" },
  { key: 6, labelKey: "stepReview" },
];

export default function VendorOnboardingWizard({
  locale: serverLocale,
  mode,
  internationalNotice,
  initialReferralCode = "",
  initialStep = 1,
  needsStoreBootstrap = false,
}: {
  locale: Locale;
  mode: "guest" | "loggedIn";
  internationalNotice: {
    title: string;
    intro: string;
    point1: string;
    point2: string;
    point3: string;
    point4: string;
    platformClause: string;
    agreement: string;
  } | null;
  initialReferralCode?: string;
  initialStep?: number;
  needsStoreBootstrap?: boolean;
}) {
  const locale = useLiveLocale();
  const ui = useLiveCopy("sellOnboarding");
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [bootstrapping, setBootstrapping] = useState(needsStoreBootstrap);
  const [step, setStep] = useState<Step>(
    needsStoreBootstrap
      ? 1
      : mode === "loggedIn"
        ? (Math.min(Math.max(initialStep, 2), 6) as Step)
        : 1,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [repNameEn, setRepNameEn] = useState("");
  const [repNameOther, setRepNameOther] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [shortBusinessNote, setShortBusinessNote] = useState("");
  const [acceptCommissionTerms, setAcceptCommissionTerms] = useState(false);
  const [acceptedDocs, setAcceptedDocs] = useState<Record<string, boolean>>({});
  const [referralCode, setReferralCode] = useState(initialReferralCode.trim().toUpperCase());

  const [fullNameEn, setFullNameEn] = useState("");
  const [fullNameOther, setFullNameOther] = useState("");
  const [identityDocumentKind, setIdentityDocumentKind] = useState("NATIONAL_ID");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentExpiresAt, setDocumentExpiresAt] = useState("");
  const [addressOptional, setAddressOptional] = useState("");

  const [legalNameEn, setLegalNameEn] = useState("");
  const [legalNameOther, setLegalNameOther] = useState("");
  const [entityType, setEntityType] = useState("INDIVIDUAL");
  const [countryCode, setCountryCode] = useState("SA");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [poBox, setPoBox] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [mapFilling, setMapFilling] = useState(false);
  const mapLookupTimer = useRef<number | null>(null);
  const mapLookupSeq = useRef(0);
  const [additionalInfo, setAdditionalInfo] = useState("");

  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "ok" | "bad">("idle");
  const [storeNameOther, setStoreNameOther] = useState("");
  const [storeDescriptionEn, setStoreDescriptionEn] = useState("");
  const [storeDescriptionOther, setStoreDescriptionOther] = useState("");
  const [acceptInternationalSales, setAcceptInternationalSales] = useState(false);

  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatTrn, setVatTrn] = useState("");
  const [vatPercent, setVatPercent] = useState("15");
  const [hasBankAccount, setHasBankAccount] = useState(false);
  const [payoutIban, setPayoutIban] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutAccountHolder, setPayoutAccountHolder] = useState("");

  const [confirmComplete, setConfirmComplete] = useState(false);
  const [fieldReviews, setFieldReviews] = useState<
    { pageKey: string; fieldKey: string; decision: string; note: string | null }[]
  >([]);

  void serverLocale;

  const loadState = useCallback(async () => {
    if (mode !== "loggedIn" && step === 1) return;
    const res = await fetch("/api/v1/seller/onboarding", { credentials: "include", cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      vendor: Record<string, unknown>;
      ownerEmail?: string;
      fieldReviews?: { pageKey: string; fieldKey: string; decision: string; note: string | null }[];
    };
    const v = data.vendor;
    if (v.onboardingStatus === "UNDER_REVIEW") {
      setStep("under_review");
      setFieldReviews(data.fieldReviews ?? []);
      return;
    }
    if (v.onboardingStatus === "ACTIVE") {
      setStep("done");
      return;
    }
    if (typeof v.repNameEn === "string") setRepNameEn(v.repNameEn);
    if (typeof v.repNameOther === "string") setRepNameOther(v.repNameOther);
    if (typeof v.contactPhone === "string") setPhone(v.contactPhone);
    if (typeof data.ownerEmail === "string") setEmail(data.ownerEmail);
    if (typeof v.storeName === "string") setStoreName(v.storeName);
    if (typeof v.storeNameOther === "string") setStoreNameOther(v.storeNameOther);
    if (typeof v.slug === "string") setSlug(v.slug);
    if (typeof v.shortBusinessNote === "string") setShortBusinessNote(v.shortBusinessNote);
    if (typeof v.legalNameEn === "string") setLegalNameEn(v.legalNameEn);
    if (typeof v.legalNameOther === "string") setLegalNameOther(v.legalNameOther);
    if (typeof v.entityType === "string") setEntityType(v.entityType);
    if (typeof v.countryCode === "string") setCountryCode(v.countryCode);
    if (typeof v.state === "string") setRegion(v.state);
    if (typeof v.city === "string" && v.city !== "To be completed") setCity(v.city);
    if (typeof v.addressLine2 === "string") setDistrict(v.addressLine2);
    if (typeof v.addressLine1 === "string" && v.addressLine1 !== "To be completed") setStreet(v.addressLine1);
    if (typeof v.postalCode === "string" && v.postalCode !== "00000") setPostalCode(v.postalCode);
    if (typeof v.storeDescriptionEn === "string") setStoreDescriptionEn(v.storeDescriptionEn);
    if (typeof v.storeDescriptionOther === "string") setStoreDescriptionOther(v.storeDescriptionOther);
    if (typeof v.invoiceVatTrn === "string") {
      setVatRegistered(true);
      setVatTrn(v.invoiceVatTrn);
    }
    if (v.invoiceVatPercent != null) setVatPercent(String(v.invoiceVatPercent));
    if (typeof v.payoutIban === "string") {
      setHasBankAccount(true);
      setPayoutIban(v.payoutIban);
    }
    if (typeof v.payoutAccountHolder === "string") setPayoutAccountHolder(v.payoutAccountHolder);
    setFullNameEn(typeof v.repNameEn === "string" ? v.repNameEn : "");
    setFullNameOther(typeof v.repNameOther === "string" ? v.repNameOther : "");
    setFieldReviews(data.fieldReviews ?? []);
    const nextStep = typeof v.onboardingStep === "number" ? v.onboardingStep : 2;
    if (typeof step === "number" && step < 2) setStep(Math.min(Math.max(nextStep, 2), 6) as Step);
  }, [mode, step]);

  useEffect(() => {
    if (mode === "loggedIn" || (typeof step === "number" && step >= 2)) {
      void loadState();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps -- load once on mount / after account create

  const checkSlugAvailability = useCallback(async (nextSlug: string, nextStoreName: string) => {
    const q = new URLSearchParams();
    if (nextSlug) q.set("slug", nextSlug);
    if (nextStoreName) q.set("storeName", nextStoreName);
    const res = await fetch(`/api/v1/public/seller/check-slug?${q}`, { cache: "no-store" });
    if (!res.ok) {
      setSlugStatus("bad");
      return null;
    }
    return (await res.json()) as { available: boolean; suggestion?: string };
  }, []);

  useEffect(() => {
    if (step !== 4 || !storeName.trim()) return;
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        if (!slugManual) {
          const suggested = await checkSlugAvailability("", storeName);
          if (cancelled || !suggested?.suggestion) return;
          setSlug(suggested.suggestion);
          const availability = await checkSlugAvailability(suggested.suggestion, storeName);
          if (cancelled || !availability) return;
          setSlugStatus(availability.available ? "ok" : "bad");
          return;
        }
        const availability = await checkSlugAvailability(slug, storeName);
        if (cancelled || !availability) return;
        setSlugStatus(availability.available ? "ok" : "bad");
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, slug, storeName, slugManual, checkSlugAvailability]);

  async function saveStep(nextStep: number, data: Record<string, unknown>) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/seller/onboarding/step", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: nextStep, data }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.errorGeneric);
      }
      setStep((nextStep + 1) as Step);
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.errorGeneric;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const allMerchantDocsAccepted = MERCHANT_REGISTRATION_DOCUMENT_TYPES.every(
    (doc) => acceptedDocs[doc] === true,
  );
  const acceptedDocumentTypes = MERCHANT_REGISTRATION_DOCUMENT_TYPES.filter(
    (doc) => acceptedDocs[doc] === true,
  );

  async function submitAccount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acceptCommissionTerms || !allMerchantDocsAccepted) return;
    if (bootstrapping) {
      if (!repNameEn.trim() || !phone.trim() || !storeName.trim()) {
        setError(ui.required);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/v1/seller/onboarding/start-existing", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeName,
            phone,
            repNameEn,
            repNameOther: repNameOther || undefined,
            shortBusinessNote: shortBusinessNote || undefined,
            acceptCommissionTerms: true,
            acceptedDocumentTypes,
          }),
        });
        if (!res.ok) {
          const p = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(p?.error ?? ui.errorGeneric);
        }
        setBootstrapping(false);
        setFullNameEn(repNameEn);
        setFullNameOther(repNameOther);
        setStep(2);
        toast.success(toastDict.storeCreated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : ui.errorGeneric;
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!isValidEmail(email)) {
      setError(ui.invalidEmail);
      return;
    }
    if (!isValidMerchantUsername(username)) {
      setError(ui.invalidUsername);
      return;
    }
    if (!isStrongPassword(password)) {
      setError(ui.invalidPassword);
      return;
    }
    if (password !== confirmPassword) {
      setError(ui.passwordMismatch);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/seller/onboarding/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repNameEn,
          repNameOther: repNameOther || undefined,
          phone,
          email,
          username: username.trim().toLowerCase(),
          password,
          confirmPassword,
          storeName,
          shortBusinessNote: shortBusinessNote || undefined,
          acceptCommissionTerms: true,
          acceptedDocumentTypes,
          turnstileToken: turnstileToken || undefined,
          referralCode: referralCode.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
        const raw = p?.error ?? "";
        const code = p?.code ?? "";
        if (/password/i.test(raw)) throw new Error(ui.invalidPassword);
        if (/username/i.test(raw)) throw new Error(ui.invalidUsername);
        if (/referral/i.test(raw)) throw new Error(ui.invalidReferral);
        if (code === "CUSTOMER_EMAIL_EXISTS" || code === "EMAIL_IN_USE") {
          throw new Error(ui.emailRegisteredAsCustomer);
        }
        if (/captcha|turnstile/i.test(raw)) throw new Error(ui.captchaFailed ?? raw);
        throw new Error(ui.errorGeneric);
      }
      setFullNameEn(repNameEn);
      setFullNameOther(repNameOther);
      setStep(2);
      toast.success(toastDict.onboardingComplete);
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.errorGeneric;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    if (!confirmComplete) return;
    if (internationalNotice && !acceptInternationalSales) return;
    setError(null);
    setLoading(true);
    try {
      if (internationalNotice && acceptInternationalSales) {
        await fetch("/api/v1/seller/onboarding/step", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: 5,
            data: {
              vatRegistered,
              vatTrn: vatRegistered ? vatTrn : "",
              vatPercent: vatRegistered ? Number(vatPercent) : null,
              hasBankAccount,
              payoutIban: hasBankAccount ? payoutIban : "",
              payoutBankName: hasBankAccount ? payoutBankName : "",
              payoutAccountHolder: hasBankAccount ? payoutAccountHolder : "",
              acceptCrossMarketTerms: true,
            },
          }),
        });
      }
      const res = await fetch("/api/v1/seller/onboarding/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmComplete: true }),
      });
      if (!res.ok) throw new Error(ui.errorGeneric);
      setStep("under_review");
      toast.success(ui.submittedForReview ?? "Submitted for review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.errorGeneric;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "app-input border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] dark:border-[var(--border-strong)]";

  if (step === "under_review") {
    return (
      <div className="app-callout mt-8 p-8" dir={direction}>
        <h2 className="text-xl font-semibold">{ui.underReviewTitle ?? "Under review"}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {ui.underReviewBody ?? "Our team is reviewing your application. You will be notified when a decision is made."}
        </p>
        {fieldReviews.some((f) => f.decision === "NEEDS_FIX") ? (
          <ul className="mt-4 list-disc space-y-1 ps-5 text-sm text-amber-800 dark:text-amber-200">
            {fieldReviews
              .filter((f) => f.decision === "NEEDS_FIX")
              .map((f) => (
                <li key={`${f.pageKey}-${f.fieldKey}`}>
                  {f.fieldKey}: {f.note || (ui.needsFix ?? "Needs a fix")}
                </li>
              ))}
          </ul>
        ) : null}
        <Link href="/account/merchant" className="mt-6 inline-flex rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">
          {ui.goToLogin}
        </Link>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="app-callout-success mt-8 p-8" dir={direction}>
        <h2 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">{ui.successTitle}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{ui.successBody}</p>
        <Link href="/vendor/products" className="mt-6 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
          {ui.goToDashboard ?? ui.goToLogin}
        </Link>
      </div>
    );
  }

  const primaryMarket = primaryMarketFromCountry(countryCode);

  return (
    <div className="mt-8" dir={direction}>
      <ol className="mb-8 flex flex-wrap gap-3 text-sm font-medium">
        {STEPS.map((s) => (
          <li
            key={String(s.key)}
            className={step === s.key ? "text-[var(--primary)]" : "text-[var(--muted)]"}
          >
            {s.key}. {(ui as Record<string, string>)[s.labelKey] ?? s.labelKey}
          </li>
        ))}
      </ol>

      {error ? <p className="mb-4 app-alert-error">{error}</p> : null}

      {step === 1 && (mode === "guest" || bootstrapping) ? (
        <form className="mx-auto max-w-lg space-y-4" noValidate onSubmit={submitAccount}>
          <BilingualRow
            labelEn={ui.repNameEn ?? "Representative name (English)"}
            labelOther={ui.repNameOther ?? "Representative name (other language)"}
            valueEn={repNameEn}
            valueOther={repNameOther}
            onEn={setRepNameEn}
            onOther={setRepNameOther}
            required
            className={inputClass}
          />
          <Field label={ui.phone ?? "Phone"} required>
            <input className={inputClass} required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          {!bootstrapping ? (
            <>
              <Field label={ui.email} required>
                <input className={inputClassName(false)} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label={ui.merchantUsername} required hint={ui.merchantUsernameHint}>
                <input className={inputClass} required value={username} onChange={(e) => setUsername(e.target.value)} />
              </Field>
              <Field label={ui.password} required>
                <input className={inputClass} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label={ui.confirmPassword} required>
                <input className={inputClass} type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </Field>
            </>
          ) : null}
          <Field label={ui.storeName} required>
            <input className={inputClass} required value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </Field>
          <Field label={ui.shortBusinessNote ?? "Short business note (optional)"}>
            <textarea className={inputClass} rows={3} value={shortBusinessNote} onChange={(e) => setShortBusinessNote(e.target.value)} />
          </Field>
          {!bootstrapping ? (
            <Field label={ui.referralCode}>
              <input className={inputClass} value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} />
            </Field>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acceptCommissionTerms} onChange={(e) => setAcceptCommissionTerms(e.target.checked)} className="mt-1" />
            <span>{ui.acceptCommissionTerms ?? "I accept the marketplace commission terms"}</span>
          </label>
          <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs font-medium text-[var(--muted)]">
              {ui.acceptAllPolicies ?? "Accept all policies to continue (account stays inactive until complete)."}
            </p>
            {MERCHANT_REGISTRATION_DOCUMENT_TYPES.map((doc) => {
              const title = LEGAL_DOCUMENT_TITLES[doc as LegalDocumentType];
              const label = locale === "ar" ? title.ar : title.en;
              return (
                <label key={doc} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acceptedDocs[doc] === true}
                    onChange={(e) =>
                      setAcceptedDocs((prev) => ({ ...prev, [doc]: e.target.checked }))
                    }
                  />
                  <span>
                    {ui.acceptPrefix ?? "I agree to"}{" "}
                    <a
                      href={legalDocumentHref(doc as LegalDocumentType)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link underline"
                    >
                      {label}
                    </a>
                  </span>
                </label>
              );
            })}
          </div>
          {!bootstrapping ? <TurnstileWidget onToken={setTurnstileToken} /> : null}
          <button
            type="submit"
            disabled={loading || !acceptCommissionTerms || !allMerchantDocsAccepted}
            className="btn-primary btn-press w-full disabled:opacity-50"
          >
            {loading ? ui.submitting : ui.next}
          </button>
          {!bootstrapping ? (
            <p className="text-center text-sm text-[var(--muted)]">
              {ui.existingAccount}{" "}
              <Link href="/account/merchant" className="text-link">
                {ui.signIn}
              </Link>
            </p>
          ) : null}
        </form>
      ) : null}

      {step === 2 ? (
        <form
          className="mx-auto max-w-lg space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveStep(2, {
              fullNameEn,
              fullNameOther,
              phone,
              email,
              identityDocumentKind,
              documentNumber,
              documentExpiresAt: documentExpiresAt || undefined,
              addressOptional: addressOptional || undefined,
            });
          }}
        >
          <BilingualRow
            labelEn={ui.fullNameEn ?? "Full name (English)"}
            labelOther={ui.fullNameOther ?? "Full name (other language)"}
            valueEn={fullNameEn}
            valueOther={fullNameOther}
            onEn={setFullNameEn}
            onOther={setFullNameOther}
            required
            className={inputClass}
          />
          <Field label={ui.phone ?? "Phone"} required>
            <input className={inputClass} required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={ui.email} required>
            <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={ui.identityDocumentKind ?? "ID document type"} required>
            <select className={inputClass} value={identityDocumentKind} onChange={(e) => setIdentityDocumentKind(e.target.value)}>
              <option value="NATIONAL_ID">National ID</option>
              <option value="PASSPORT">Passport</option>
              <option value="RESIDENCY">Residency</option>
              <option value="DRIVING_LICENSE">Driving license</option>
              <option value="TAX_ID">Tax ID</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label={ui.documentNumber ?? "Document number"} required>
            <input className={inputClass} required value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
          </Field>
          <Field label={ui.documentExpiresAt ?? "Expiry (optional)"}>
            <input className={inputClass} value={documentExpiresAt} onChange={(e) => setDocumentExpiresAt(e.target.value)} placeholder="YYYY-MM-DD" />
          </Field>
          <Field label={ui.addressOptional ?? "Address (optional)"}>
            <textarea className={inputClass} rows={2} value={addressOptional} onChange={(e) => setAddressOptional(e.target.value)} />
          </Field>
          <p className="text-xs text-[var(--muted)]">
            {ui.kycUploadHint ?? "Upload identity documents from Vendor → KYC after this wizard if needed."}
          </p>
          <NavButtons loading={loading} back={() => setStep(1)} backLabel={ui.back} nextLabel={ui.next} />
        </form>
      ) : null}

      {step === 3 ? (
        <form
          className="mx-auto max-w-lg space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveStep(3, {
              legalNameEn,
              legalNameOther,
              phone: phone || undefined,
              email: email || undefined,
              entityType,
              countryCode,
              region,
              city,
              district,
              street,
              landmark: landmark || undefined,
              postalCode,
              poBox: poBox || undefined,
              googleMapsUrl: googleMapsUrl || undefined,
              additionalInfo: additionalInfo || undefined,
            });
          }}
        >
          <BilingualRow
            labelEn={ui.legalNameEn ?? "Legal name (English)"}
            labelOther={ui.legalNameOther ?? "Legal name (other language)"}
            valueEn={legalNameEn}
            valueOther={legalNameOther}
            onEn={setLegalNameEn}
            onOther={setLegalNameOther}
            required
            bothRequired
            className={inputClass}
          />
          <Field label={ui.entityType ?? "Entity type"} required>
            <select className={inputClass} value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="COMPANY">Company</option>
              <option value="ESTABLISHMENT">Establishment</option>
              <option value="FREELANCE">Freelance</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label={ui.country} required>
            <select className={inputClass} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              <option value="SA">{ui.countrySA}</option>
              <option value="AE">{ui.countryAE}</option>
              <option value="OM">{ui.countryOM}</option>
              <option value="EG">{ui.countryEG}</option>
              <option value="XX">{ui.countryOther}</option>
            </select>
          </Field>
          <p className="text-xs text-[var(--muted)]">
            {ui.primaryMarketTitle}: {(ui as Record<string, string>)[`primaryMarket${primaryMarket}`] ?? primaryMarket}
          </p>

          <div className="rounded-lg border border-dashed border-[var(--border)] p-3 space-y-3">
            <div>
              <p className="text-sm font-medium">{ui.mapPin ?? "Map pin"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {ui.mapPinHint ??
                  "Drop a pin to fill street, district, city, region, and postal code. You can still edit the fields."}
              </p>
            </div>
            <AddressMapPicker
              countryCode={
                (isAddressCountryCode(countryCode) ? countryCode : "SA") as AddressCountryCode
              }
              latitude={latitude}
              longitude={longitude}
              onChange={(lat: string, lng: string) => {
                setLatitude(lat);
                setLongitude(lng);
                setGoogleMapsUrl(mapsUrlFromLatLng(lat, lng));
                setMapFilling(true);
                if (mapLookupTimer.current != null) window.clearTimeout(mapLookupTimer.current);
                const seq = ++mapLookupSeq.current;
                mapLookupTimer.current = window.setTimeout(() => {
                  void reverseGeocodeLatLng(lat, lng)
                    .then((geo) => {
                      if (seq !== mapLookupSeq.current) return;
                      if (!geo) {
                        toast.error(ui.mapFillFailed ?? "Could not look up that pin. Fill the fields manually.");
                        return;
                      }
                      if (geo.street) setStreet(geo.street);
                      if (geo.district) setDistrict(geo.district);
                      if (geo.city) setCity(geo.city);
                      if (geo.region) setRegion(geo.region);
                      if (geo.postalCode) setPostalCode(geo.postalCode);
                      if (
                        geo.countryCode &&
                        ["SA", "AE", "OM", "EG"].includes(geo.countryCode)
                      ) {
                        setCountryCode(geo.countryCode);
                      }
                    })
                    .catch(() => {
                      if (seq !== mapLookupSeq.current) return;
                      toast.error(ui.mapFillFailed ?? "Could not look up that pin. Fill the fields manually.");
                    })
                    .finally(() => {
                      if (seq === mapLookupSeq.current) setMapFilling(false);
                    });
                }, 450);
              }}
            />
            {mapFilling ? (
              <p className="text-xs text-[var(--muted)]">{ui.mapFilling ?? "Looking up address…"}</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={ui.latitude ?? "Latitude"}>
                <input className={inputClass} inputMode="decimal" value={latitude} readOnly />
              </Field>
              <Field label={ui.longitude ?? "Longitude"}>
                <input className={inputClass} inputMode="decimal" value={longitude} readOnly />
              </Field>
            </div>
          </div>

          <Field label={ui.state} required>
            <input className={inputClass} required value={region} onChange={(e) => setRegion(e.target.value)} />
          </Field>
          <Field label={ui.city} required>
            <input className={inputClass} required value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label={ui.district ?? "District"} required>
            <input className={inputClass} required value={district} onChange={(e) => setDistrict(e.target.value)} />
          </Field>
          <Field label={ui.street ?? "Street"} required>
            <input className={inputClass} required value={street} onChange={(e) => setStreet(e.target.value)} />
          </Field>
          <Field label={ui.landmark ?? "Landmark (optional)"}>
            <input className={inputClass} value={landmark} onChange={(e) => setLandmark(e.target.value)} />
          </Field>
          <Field label={ui.postalCode} required>
            <input className={inputClass} required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </Field>
          <Field label={ui.poBox ?? "P.O. Box (optional)"}>
            <input className={inputClass} value={poBox} onChange={(e) => setPoBox(e.target.value)} />
          </Field>
          <Field label={ui.googleMapsUrl ?? "Google Maps URL (optional)"}>
            <input className={inputClass} value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} />
          </Field>
          <Field label={ui.additionalInfo ?? "Additional info (optional)"}>
            <textarea className={inputClass} rows={2} value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} />
          </Field>
          <NavButtons loading={loading} back={() => setStep(2)} backLabel={ui.back} nextLabel={ui.next} />
        </form>
      ) : null}

      {step === 4 ? (
        <form
          className="mx-auto max-w-lg space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (slugStatus === "bad") {
              setError(ui.slugTaken);
              return;
            }
            void saveStep(4, {
              slug,
              storeName,
              storeNameOther: storeNameOther || undefined,
              storeDescriptionEn,
              storeDescriptionOther: storeDescriptionOther || undefined,
            });
          }}
        >
          <Field label={ui.storeName} required>
            <input className={inputClass} required value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </Field>
          <Field label={ui.storeNameOther ?? "Store name (other language)"}>
            <input className={inputClass} value={storeNameOther} onChange={(e) => setStoreNameOther(e.target.value)} />
          </Field>
          <Field label={ui.storeSlug} required hint={ui.storeSlugHint}>
            <input
              className={inputClass}
              required
              value={slug}
              onChange={(e) => {
                setSlugManual(true);
                setSlug(e.target.value.toLowerCase());
              }}
            />
            {slugStatus === "ok" ? <span className="text-xs text-emerald-600">{ui.slugAvailable}</span> : null}
            {slugStatus === "bad" ? <span className="text-xs text-red-600">{ui.slugTaken}</span> : null}
          </Field>
          <BilingualRow
            labelEn={ui.storeDescriptionEn ?? "Store description (English)"}
            labelOther={ui.storeDescriptionOther ?? "Store description (other language)"}
            valueEn={storeDescriptionEn}
            valueOther={storeDescriptionOther}
            onEn={setStoreDescriptionEn}
            onOther={setStoreDescriptionOther}
            required
            multiline
            className={inputClass}
          />
          <NavButtons loading={loading} back={() => setStep(3)} backLabel={ui.back} nextLabel={ui.next} />
        </form>
      ) : null}

      {step === 5 ? (
        <form
          className="mx-auto max-w-lg space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveStep(5, {
              vatRegistered,
              vatTrn: vatRegistered ? vatTrn : "",
              vatPercent: vatRegistered ? Number(vatPercent) : null,
              hasBankAccount,
              payoutIban: hasBankAccount ? payoutIban : "",
              payoutBankName: hasBankAccount ? payoutBankName : "",
              payoutAccountHolder: hasBankAccount ? payoutAccountHolder : "",
            });
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={vatRegistered} onChange={(e) => setVatRegistered(e.target.checked)} />
            {ui.vatRegistered ?? "VAT registered"}
          </label>
          {vatRegistered ? (
            <>
              <Field label={ui.vatTrn ?? "VAT TRN"} required>
                <input className={inputClass} required value={vatTrn} onChange={(e) => setVatTrn(e.target.value)} />
              </Field>
              <Field label={ui.vatPercent ?? "VAT %"}>
                <input className={inputClass} type="number" min={0} max={100} value={vatPercent} onChange={(e) => setVatPercent(e.target.value)} />
              </Field>
            </>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasBankAccount} onChange={(e) => setHasBankAccount(e.target.checked)} />
            {ui.hasBankAccount ?? "I have a bank account for payouts"}
          </label>
          {hasBankAccount ? (
            <>
              <Field label={ui.payoutIban ?? "IBAN"}>
                <input className={inputClass} value={payoutIban} onChange={(e) => setPayoutIban(e.target.value)} />
              </Field>
              <Field label={ui.payoutBankName ?? "Bank name"}>
                <input className={inputClass} value={payoutBankName} onChange={(e) => setPayoutBankName(e.target.value)} />
              </Field>
              <Field label={ui.payoutAccountHolder ?? "Account holder"}>
                <input className={inputClass} value={payoutAccountHolder} onChange={(e) => setPayoutAccountHolder(e.target.value)} />
              </Field>
            </>
          ) : null}
          <NavButtons loading={loading} back={() => setStep(4)} backLabel={ui.back} nextLabel={ui.next} />
        </form>
      ) : null}

      {step === 6 ? (
        <form className="mx-auto max-w-lg space-y-4" onSubmit={submitReview}>
          <div className="rounded-lg border border-[var(--border)] p-4 text-sm space-y-2">
            <p><strong>{ui.storeName}:</strong> {storeName}</p>
            <p><strong>{ui.storeSlug}:</strong> /stores/{slug}</p>
            <p><strong>{ui.email}:</strong> {email}</p>
            <p><strong>{ui.phone ?? "Phone"}:</strong> {phone}</p>
            <p><strong>{ui.legalNameEn ?? "Legal name"}:</strong> {legalNameEn} / {legalNameOther}</p>
          </div>
          {internationalNotice ? (
            <div className="rounded-lg border border-[var(--border-strong)] p-4 text-sm space-y-2">
              <h3 className="font-semibold">{internationalNotice.title}</h3>
              <p>{internationalNotice.intro}</p>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={acceptInternationalSales} onChange={(e) => setAcceptInternationalSales(e.target.checked)} />
                <span>{internationalNotice.agreement}</span>
              </label>
            </div>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={confirmComplete} onChange={(e) => setConfirmComplete(e.target.checked)} />
            <span>{ui.confirmComplete ?? "I confirm the information is complete and accurate"}</span>
          </label>
          <NavButtons
            loading={loading}
            back={() => setStep(5)}
            backLabel={ui.back}
            nextLabel={loading ? ui.submitting : (ui.submitForReview ?? ui.submit)}
            disabled={!confirmComplete || (Boolean(internationalNotice) && !acceptInternationalSales)}
          />
        </form>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p> : null}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function BilingualRow({
  labelEn,
  labelOther,
  valueEn,
  valueOther,
  onEn,
  onOther,
  required,
  bothRequired,
  multiline,
  className,
}: {
  labelEn: string;
  labelOther: string;
  valueEn: string;
  valueOther: string;
  onEn: (v: string) => void;
  onOther: (v: string) => void;
  required?: boolean;
  bothRequired?: boolean;
  multiline?: boolean;
  className: string;
}) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <div className="space-y-3">
      <Field label={labelEn} required={required}>
        <Tag
          className={className}
          required={required}
          value={valueEn}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onEn(e.target.value)}
          {...(multiline ? { rows: 4 } : {})}
        />
      </Field>
      <Field label={labelOther} required={bothRequired}>
        <Tag
          className={className}
          required={bothRequired}
          value={valueOther}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onOther(e.target.value)}
          {...(multiline ? { rows: 4 } : {})}
        />
      </Field>
    </div>
  );
}

function NavButtons({
  loading,
  back,
  backLabel,
  nextLabel,
  disabled,
}: {
  loading: boolean;
  back: () => void;
  backLabel: string;
  nextLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={back} className="btn-secondary btn-press flex-1" disabled={loading}>
        {backLabel}
      </button>
      <button type="submit" className="btn-primary btn-press flex-1 disabled:opacity-50" disabled={loading || disabled}>
        {nextLabel}
      </button>
    </div>
  );
}
