"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type FieldReview = {
  pageKey: string;
  fieldKey: string;
  decision: "PENDING" | "ACCEPTED" | "NEEDS_FIX";
  note: string | null;
};

type VendorDetail = {
  id: string;
  storeName: string;
  slug: string;
  onboardingStatus: string;
  repNameEn: string | null;
  repNameOther: string | null;
  legalNameEn: string | null;
  legalNameOther: string | null;
  storeNameOther: string | null;
  storeDescriptionEn: string | null;
  storeDescriptionOther: string | null;
  entityType: string | null;
  contactPhone: string | null;
  countryCode: string;
  addressLine1: string;
  addressLine2: string | null;
  state: string | null;
  city: string;
  postalCode: string;
  invoiceVatTrn: string | null;
  payoutIban: string | null;
  payoutAccountHolder: string | null;
  shortBusinessNote: string | null;
  owner: { name: string; email: string };
};

const REVIEW_FIELDS: { pageKey: string; fieldKey: string; label: string; value: (v: VendorDetail) => string }[] = [
  { pageKey: "personal", fieldKey: "repNameEn", label: "Rep name (EN)", value: (v) => v.repNameEn ?? "—" },
  { pageKey: "personal", fieldKey: "repNameOther", label: "Rep name (other)", value: (v) => v.repNameOther ?? "—" },
  { pageKey: "legal", fieldKey: "legalNameEn", label: "Legal name (EN)", value: (v) => v.legalNameEn ?? "—" },
  { pageKey: "legal", fieldKey: "legalNameOther", label: "Legal name (other)", value: (v) => v.legalNameOther ?? "—" },
  { pageKey: "legal", fieldKey: "entityType", label: "Entity type", value: (v) => v.entityType ?? "—" },
  { pageKey: "legal", fieldKey: "address", label: "Address", value: (v) => `${v.addressLine1}, ${v.city}, ${v.countryCode}` },
  { pageKey: "store", fieldKey: "storeName", label: "Store name", value: (v) => v.storeName },
  { pageKey: "store", fieldKey: "storeNameOther", label: "Store name (other)", value: (v) => v.storeNameOther ?? "—" },
  { pageKey: "store", fieldKey: "storeDescriptionEn", label: "Description (EN)", value: (v) => v.storeDescriptionEn ?? "—" },
  { pageKey: "financial", fieldKey: "invoiceVatTrn", label: "VAT TRN", value: (v) => v.invoiceVatTrn ?? "—" },
  { pageKey: "financial", fieldKey: "payoutIban", label: "IBAN", value: (v) => v.payoutIban ?? "—" },
];

export default function AdminOnboardingReview({
  vendorId,
  locale,
  ui,
}: {
  vendorId: string;
  locale: "en" | "ar";
  ui: {
    loading: string;
    loadError: string;
    back: string;
    accept: string;
    needsFix: string;
    approve: string;
    reject: string;
    toastSaved: string;
    toastApproved: string;
    toastRejected: string;
    notePlaceholder: string;
  };
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const toast = useToast();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [reviews, setReviews] = useState<FieldReview[]>([]);
  const [profileChanges, setProfileChanges] = useState<
    { id: string; proposedJson: Record<string, unknown>; vendorNote: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/vendors/${vendorId}/onboarding`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as {
        vendor: VendorDetail;
        fieldReviews: FieldReview[];
        profileChangeRequests?: {
          id: string;
          proposedJson: Record<string, unknown>;
          vendorNote: string | null;
        }[];
      };
      setVendor(data.vendor);
      setReviews(data.fieldReviews);
      setProfileChanges(data.profileChangeRequests ?? []);
    } catch {
      toast.error(ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [vendorId, ui.loadError, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decideField(pageKey: string, fieldKey: string, decision: "ACCEPTED" | "NEEDS_FIX") {
    setBusy(true);
    try {
      const key = `${pageKey}:${fieldKey}`;
      const res = await fetch(`/api/v1/admin/vendors/${vendorId}/onboarding`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "field",
          pageKey,
          fieldKey,
          decision,
          note: noteDraft[key] || null,
        }),
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { fieldReviews: FieldReview[] };
      setReviews(data.fieldReviews);
      toast.success(ui.toastSaved);
    } catch {
      toast.error(ui.loadError);
    } finally {
      setBusy(false);
    }
  }

  async function finalAction(action: "approve" | "reject") {
    const note = window.prompt(ui.notePlaceholder) ?? "";
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/vendors/${vendorId}/onboarding`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || null }),
      });
      if (!res.ok) throw new Error(ui.loadError);
      toast.success(action === "approve" ? ui.toastApproved : ui.toastRejected);
      await load();
    } catch {
      toast.error(ui.loadError);
    } finally {
      setBusy(false);
    }
  }

  function decisionFor(pageKey: string, fieldKey: string) {
    return reviews.find((r) => r.pageKey === pageKey && r.fieldKey === fieldKey)?.decision ?? "PENDING";
  }

  if (loading || !vendor) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  return (
    <div className="mt-8 space-y-6" dir={direction}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{vendor.storeName}</h2>
          <p className="text-sm text-[var(--muted)]">
            {vendor.owner.name} · {vendor.owner.email} · {vendor.onboardingStatus}
          </p>
        </div>
        <Link href="/admin/vendors/onboarding" className="text-sm text-link">
          {ui.back}
        </Link>
      </div>

      <div className="space-y-4">
        {REVIEW_FIELDS.map((f) => {
          const key = `${f.pageKey}:${f.fieldKey}`;
          const decision = decisionFor(f.pageKey, f.fieldKey);
          return (
            <div key={key} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{f.label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{f.value(vendor)}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Status: {decision}</p>
                </div>
                <div className="flex flex-col gap-2 sm:w-64">
                  <input
                    className="app-input text-sm"
                    placeholder={ui.notePlaceholder}
                    value={noteDraft[key] ?? ""}
                    onChange={(e) => setNoteDraft((d) => ({ ...d, [key]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decideField(f.pageKey, f.fieldKey, "ACCEPTED")}
                      className="flex-1 rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {ui.accept}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decideField(f.pageKey, f.fieldKey, "NEEDS_FIX")}
                      className="flex-1 rounded border border-[var(--border-strong)] px-2 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      {ui.needsFix}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {profileChanges.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-amber-500/40 p-4">
          <h3 className="font-semibold">Pending profile change requests</h3>
          {profileChanges.map((req) => (
            <div key={req.id} className="space-y-2 text-sm">
              <pre className="overflow-x-auto rounded bg-[var(--muted-bg)] p-2 text-xs">
                {JSON.stringify(req.proposedJson, null, 2)}
              </pre>
              {req.vendorNote ? <p className="text-[var(--muted)]">Note: {req.vendorNote}</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        const res = await fetch(
                          `/api/v1/admin/vendors/profile-change-requests/${req.id}`,
                          {
                            method: "PATCH",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve" }),
                          },
                        );
                        if (!res.ok) throw new Error(ui.loadError);
                        toast.success(ui.toastApproved);
                        await load();
                      } catch {
                        toast.error(ui.loadError);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  {ui.approve}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-[var(--border-strong)] px-3 py-1 text-xs font-semibold disabled:opacity-50"
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        const res = await fetch(
                          `/api/v1/admin/vendors/profile-change-requests/${req.id}`,
                          {
                            method: "PATCH",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "reject" }),
                          },
                        );
                        if (!res.ok) throw new Error(ui.loadError);
                        toast.success(ui.toastRejected);
                        await load();
                      } catch {
                        toast.error(ui.loadError);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  {ui.reject}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {vendor.onboardingStatus === "UNDER_REVIEW" || vendor.onboardingStatus === "UNDER_REGISTRATION" ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void finalAction("approve")}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {ui.approve}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void finalAction("reject")}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {ui.reject}
          </button>
        </div>
      ) : null}
    </div>
  );
}
