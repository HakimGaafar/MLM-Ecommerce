"use client";

import type { CustomerProfileDto, CustomerShippingAddressDto } from "@mlm/shared";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { useAppLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";

type ProfileFormState = {
  name: string;
  phone: string;
  countryCode: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  shipSameAsBilling: boolean;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountryCode: string;
};

type AffiliateState = {
  referralCode: string | null;
  isActive: boolean;
  canEditReferralCode?: boolean;
  referralUseCount?: number;
  rankTitle?: string | null;
};

type SupportedLanguage = "en" | "ar";
type ProfileText = (typeof en)["customerProfile"];
const PROFILE_TEXT: Record<SupportedLanguage, ProfileText> = {
  en: en.customerProfile,
  ar: ar.customerProfile,
};

function toFormState(profile: CustomerProfileDto): ProfileFormState {
  return {
    name: profile.name ?? "",
    phone: profile.phone ?? "",
    countryCode: profile.countryCode ?? "SA",
    city: profile.city ?? "",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    postalCode: profile.postalCode ?? "",
    shipSameAsBilling: profile.shipSameAsBilling !== false,
    shippingAddressLine1: profile.shippingAddressLine1 ?? "",
    shippingAddressLine2: profile.shippingAddressLine2 ?? "",
    shippingCity: profile.shippingCity ?? "",
    shippingPostalCode: profile.shippingPostalCode ?? "",
    shippingCountryCode: profile.shippingCountryCode ?? "SA",
  };
}

/** When billing fields were never saved, show the default delivery address in the form for editing. */
function mergeFormWithDefaultSavedAddress(
  base: ProfileFormState,
  addr: CustomerShippingAddressDto,
): ProfileFormState {
  const billingEmpty =
    !base.city.trim() && !base.addressLine1.trim() && !base.postalCode.trim();
  if (!billingEmpty) return base;
  return {
    ...base,
    phone: base.phone.trim() ? base.phone : addr.phone,
    countryCode: addr.countryCode || base.countryCode,
    city: addr.city,
    addressLine1: addr.addressLine1,
    addressLine2: addr.addressLine2 ?? "",
    postalCode: addr.postalCode,
  };
}

export default function ProfileForm() {
  const router = useRouter();
  const toast = useToast();
  const locale = useAppLocale();
  const [initialProfile, setInitialProfile] = useState<CustomerProfileDto | null>(null);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [affiliate, setAffiliate] = useState<AffiliateState | null>(null);
  const [isAffiliateLoading, setIsAffiliateLoading] = useState(true);
  const [isAffiliateEnrolling, setIsAffiliateEnrolling] = useState(false);
  const [isReferralCodeSaving, setIsReferralCodeSaving] = useState(false);
  const [editableReferralCode, setEditableReferralCode] = useState("");
  const ui = PROFILE_TEXT[locale];
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/v1/customer/profile", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? PROFILE_TEXT.en.loadError);
        }

        const payload = (await response.json()) as CustomerProfileDto;
        if (cancelled) return;

        let nextForm = toFormState(payload);
        const addressesResponse = await fetch("/api/v1/customer/shipping-addresses", {
          credentials: "include",
          cache: "no-store",
        });
        if (addressesResponse.ok) {
          const { items } = (await addressesResponse.json()) as {
            items: CustomerShippingAddressDto[];
          };
          const defaultAddr = items.find((row) => row.isDefault) ?? items[0];
          if (defaultAddr) {
            nextForm = mergeFormWithDefaultSavedAddress(nextForm, defaultAddr);
          }
        }

        setInitialProfile(payload);
        setForm(nextForm);

        const affiliateResponse = await fetch("/api/v1/referral/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (!affiliateResponse.ok) {
          throw new Error(PROFILE_TEXT.en.affiliateLoadError);
        }
        const affiliatePayload = (await affiliateResponse.json()) as AffiliateState;
        if (cancelled) return;
        setAffiliate({
          referralCode: affiliatePayload.referralCode ?? null,
          isActive: Boolean(affiliatePayload.isActive),
          canEditReferralCode: Boolean(affiliatePayload.canEditReferralCode),
          referralUseCount: Number(affiliatePayload.referralUseCount ?? 0),
          rankTitle: affiliatePayload.rankTitle ?? null,
        });
        setEditableReferralCode(affiliatePayload.referralCode ?? "");
      } catch (fetchError) {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : PROFILE_TEXT.en.loadError);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsAffiliateLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/v1/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          countryCode: form.countryCode,
          city: form.city,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          postalCode: form.postalCode,
          shipSameAsBilling: form.shipSameAsBilling,
          shippingAddressLine1: form.shipSameAsBilling ? undefined : form.shippingAddressLine1,
          shippingAddressLine2: form.shipSameAsBilling ? undefined : form.shippingAddressLine2,
          shippingCity: form.shipSameAsBilling ? undefined : form.shippingCity,
          shippingPostalCode: form.shipSameAsBilling ? undefined : form.shippingPostalCode,
          shippingCountryCode: form.shipSameAsBilling ? undefined : form.shippingCountryCode,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? ui.saveError);
      }

      const payload = (await response.json()) as CustomerProfileDto;
      setInitialProfile(payload);
      setForm(toFormState(payload));
      setSuccess(ui.saveSuccess);
      toast.success(toastDict.profileSaved);
      router.refresh();
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : ui.saveError;
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  async function becomeAffiliate() {
    setError(null);
    setSuccess(null);
    setIsAffiliateEnrolling(true);
    try {
      const response = await fetch("/api/v1/referral/me", {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            referralCode?: string | null;
            isActive?: boolean;
            canEditReferralCode?: boolean;
            referralUseCount?: number;
          }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? ui.affiliateActivateError);
      }
      setAffiliate({
        referralCode: payload?.referralCode ?? null,
        isActive: Boolean(payload?.isActive),
        canEditReferralCode: Boolean(payload?.canEditReferralCode),
        referralUseCount: Number(payload?.referralUseCount ?? 0),
      });
      setEditableReferralCode(payload?.referralCode ?? "");
      setSuccess(ui.saveSuccess);
    } catch (activationError) {
      const msg =
        activationError instanceof Error ? activationError.message : ui.affiliateActivateError;
      setError(msg);
    } finally {
      setIsAffiliateEnrolling(false);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(ui.affiliateCopied);
    } catch {
      toast.error(ui.affiliateActivateError);
    }
  }

  async function saveReferralCode() {
    if (!affiliate?.isActive) return;
    const nextCode = editableReferralCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,24}$/.test(nextCode)) {
      setError(ui.affiliateCodeInvalid);
      return;
    }

    setError(null);
    setSuccess(null);
    setIsReferralCodeSaving(true);
    try {
      const response = await fetch("/api/v1/referral/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ referralCode: nextCode }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            referralCode?: string | null;
            isActive?: boolean;
            canEditReferralCode?: boolean;
            referralUseCount?: number;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? ui.affiliateCodeSaveError);
      }

      setAffiliate({
        referralCode: payload?.referralCode ?? null,
        isActive: Boolean(payload?.isActive),
        canEditReferralCode: Boolean(payload?.canEditReferralCode),
        referralUseCount: Number(payload?.referralUseCount ?? 0),
      });
      setEditableReferralCode(payload?.referralCode ?? "");
      setSuccess(ui.affiliateCodeSaved);
      toast.success(ui.affiliateCodeSaved);
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : ui.affiliateCodeSaveError;
      setError(msg);
      toast.error(msg);
    } finally {
      setIsReferralCodeSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error && !form) {
    return (
      <p className="app-alert-error">
        {error}
      </p>
    );
  }

  if (!form || !initialProfile) {
    return (
      <p className="app-alert-error">
        {ui.unavailable}
      </p>
    );
  }

  return (
    <form className="mt-6 grid gap-6" onSubmit={onSubmit} dir={direction}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{ui.fullName}</span>
          <input
            type="text"
            minLength={2}
            maxLength={100}
            required
            className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">{ui.phone}</span>
          <input
            type="tel"
            placeholder={ui.phonePlaceholder}
            className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </label>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {ui.billingSectionTitle}
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{ui.billingSectionHint}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">{ui.countryCode}</span>
            <input
              type="text"
              maxLength={2}
              className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
              value={form.countryCode}
              onChange={(event) => setForm({ ...form, countryCode: event.target.value })}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">{ui.city}</span>
            <input
              type="text"
              maxLength={120}
              className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">{ui.postalCode}</span>
            <input
              type="text"
              maxLength={20}
              className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
              value={form.postalCode}
              onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
            />
          </label>
        </div>

        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium">{ui.addressLine1}</span>
          <input
            type="text"
            maxLength={200}
            className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
            value={form.addressLine1}
            onChange={(event) => setForm({ ...form, addressLine1: event.target.value })}
          />
        </label>

        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium">{ui.addressLine2}</span>
          <input
            type="text"
            maxLength={200}
            className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
            value={form.addressLine2}
            onChange={(event) => setForm({ ...form, addressLine2: event.target.value })}
          />
        </label>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {ui.shippingSectionTitle}
        </h2>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 rounded border-[var(--border-strong)]"
            checked={form.shipSameAsBilling}
            onChange={(event) => setForm({ ...form, shipSameAsBilling: event.target.checked })}
          />
          <span>{ui.shipSameAsBilling}</span>
        </label>

        {!form.shipSameAsBilling ? (
          <div className="mt-4 grid gap-4 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--muted)]">{ui.shippingSectionHint}</p>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">{ui.shippingCountryCode}</span>
                <input
                  type="text"
                  maxLength={2}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
                  value={form.shippingCountryCode}
                  onChange={(event) => setForm({ ...form, shippingCountryCode: event.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">{ui.shippingCity}</span>
                <input
                  type="text"
                  maxLength={120}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
                  value={form.shippingCity}
                  onChange={(event) => setForm({ ...form, shippingCity: event.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">{ui.shippingPostalCode}</span>
                <input
                  type="text"
                  maxLength={20}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
                  value={form.shippingPostalCode}
                  onChange={(event) => setForm({ ...form, shippingPostalCode: event.target.value })}
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{ui.shippingAddressLine1}</span>
              <input
                type="text"
                maxLength={200}
                className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
                value={form.shippingAddressLine1}
                onChange={(event) => setForm({ ...form, shippingAddressLine1: event.target.value })}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{ui.shippingAddressLine2}</span>
              <input
                type="text"
                maxLength={200}
                className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] dark:bg-[var(--surface)]"
                value={form.shippingAddressLine2}
                onChange={(event) => setForm({ ...form, shippingAddressLine2: event.target.value })}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {ui.affiliateSectionTitle}
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{ui.affiliateSectionHint}</p>

        {isAffiliateLoading ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{ui.loading}</p>
        ) : affiliate?.isActive && affiliate.referralCode ? (
          <div className="mt-3 space-y-3">
            <div className="rounded-lg border border-[var(--border)] bg-white p-3 dark:bg-[var(--surface)]">
              <p className="text-xs text-[var(--muted)]">{ui.affiliateCodeLabel}</p>
              <input
                type="text"
                maxLength={24}
                value={editableReferralCode}
                onChange={(event) => setEditableReferralCode(event.target.value.toUpperCase())}
                disabled={!affiliate.canEditReferralCode || isReferralCodeSaving}
                className="mt-1 w-full rounded-md border border-[var(--border-strong)] bg-white px-3 py-2 font-mono text-base font-semibold outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[var(--surface)]"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">
                {affiliate.canEditReferralCode
                  ? ui.affiliateCodeHelpEditable
                  : ui.affiliateCodeHelpLocked}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {ui.affiliateCodeUseCount.replace("{count}", String(affiliate.referralUseCount ?? 0))}
              </p>
              {affiliate.rankTitle ? (
                <p className="mt-2 text-sm">
                  <span className="text-[var(--muted)]">{ui.affiliateRankLabel}: </span>
                  <span className="font-medium">{affiliate.rankTitle}</span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {affiliate.canEditReferralCode ? (
                <button
                  type="button"
                  disabled={isReferralCodeSaving}
                  onClick={() => void saveReferralCode()}
                  className="btn-neutral rounded-md px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isReferralCodeSaving ? ui.affiliateCodeSaving : ui.affiliateCodeSave}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => copyText(affiliate.referralCode ?? "")}
                className="btn-neutral rounded-md px-3 py-1.5 text-sm"
              >
                {ui.affiliateCopyCode}
              </button>
              <button
                type="button"
                onClick={() =>
                  copyText(`${window.location.origin}/register?ref=${affiliate.referralCode}`)
                }
                className="btn-neutral rounded-md px-3 py-1.5 text-sm"
              >
                {ui.affiliateCopyLink}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={isAffiliateEnrolling}
            onClick={becomeAffiliate}
            className="mt-3 btn-neutral rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAffiliateEnrolling ? ui.affiliateEnrolling : ui.affiliateEnroll}
          </button>
        )}
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
        disabled={isSaving}
        className="w-full btn-neutral rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? ui.saving : ui.save}
      </button>
    </form>
  );
}
