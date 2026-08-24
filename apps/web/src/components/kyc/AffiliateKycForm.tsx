"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { isAllowedKycFile, KYC_ACCEPT_ATTRIBUTE } from "@/lib/kyc-storage/mime";

type Locale = "en" | "ar";

type IdentityKind = "NATIONAL_ID" | "RESIDENCY" | "PASSPORT" | "OTHER";

type KycDoc = {
  id: string;
  status: string;
  originalFileName: string | null;
  identityDocumentKind: string | null;
  identityDocumentKindOther: string | null;
  documentNumber: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
};

type Ui = {
  loading: string;
  loadError: string;
  approvedBanner: string;
  pendingBanner: string;
  rejectedBanner: string;
  identityTypeLabel: string;
  identityTypeNationalId: string;
  identityTypeResidency: string;
  identityTypePassport: string;
  identityTypeOther: string;
  identityTypeOtherLabel: string;
  documentNumberLabel: string;
  photoLabel: string;
  photoHint: string;
  chooseFile: string;
  noFileChosen: string;
  uploadSubmit: string;
  uploadSubmitting: string;
  submitReview: string;
  submitReviewing: string;
  uploadSuccess: string;
  submitSuccess: string;
  uploadError: string;
  rejectionPrefix: string;
  viewFile: string;
  pendingReviewHint: string;
  statusLabels: Record<string, string>;
};

const inputClass =
  "mt-1 w-full rounded border border-[var(--border-strong)] px-2 py-1.5 dark:bg-[var(--surface)]";

export default function AffiliateKycForm({
  locale,
  ui,
}: {
  locale: Locale;
  ui: Ui;
}) {
  const toast = useToast();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<KycDoc | null>(null);
  const [approved, setApproved] = useState(false);
  const [identityKind, setIdentityKind] = useState<IdentityKind>("NATIONAL_ID");
  const [identityKindOther, setIdentityKindOther] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/affiliate/kyc", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as {
        summary: { approved: boolean; documents: KycDoc[] };
      };
      const identity = data.summary.documents.find((d) => d.id) ?? data.summary.documents[0] ?? null;
      setApproved(data.summary.approved);
      setDoc(identity?.id ? identity : null);
      if (identity?.identityDocumentKind) {
        setIdentityKind(identity.identityDocumentKind as IdentityKind);
      }
      if (identity?.identityDocumentKindOther) {
        setIdentityKindOther(identity.identityDocumentKindOther);
      }
      if (identity?.documentNumber) {
        setDocumentNumber(identity.documentNumber);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadDocument() {
    if (!file) {
      toast.error(ui.uploadError);
      return;
    }
    if (!documentNumber.trim()) {
      toast.error(ui.uploadError);
      return;
    }
    if (identityKind === "OTHER" && !identityKindOther.trim()) {
      toast.error(ui.uploadError);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("documentType", "NATIONAL_ID");
      form.set("identityDocumentKind", identityKind);
      if (identityKind === "OTHER") {
        form.set("identityDocumentKindOther", identityKindOther.trim());
      }
      form.set("documentNumber", documentNumber.trim());
      form.set("file", file);
      const res = await fetch("/api/v1/affiliate/kyc", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const payload = (await res.json().catch(() => null)) as { error?: string; document?: KycDoc } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.uploadError);
      setDoc(payload?.document ?? null);
      setFile(null);
      toast.success(ui.uploadSuccess);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.uploadError;
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function submitForReview() {
    if (!doc?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/affiliate/kyc/${encodeURIComponent(doc.id)}/submit`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.uploadError);
      toast.success(ui.submitSuccess);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.uploadError;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  const canEdit = !doc || doc.status === "UPLOADED" || doc.status === "REJECTED" || doc.status === "NOT_UPLOADED";
  const canSubmit = doc?.status === "UPLOADED";
  const isPending = doc?.status === "PENDING_REVIEW";

  return (
    <section dir={direction} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      {error ? <p className="app-alert-error mb-4 text-sm">{error}</p> : null}
      {approved ? (
        <p className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {ui.approvedBanner}
        </p>
      ) : isPending ? (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {ui.pendingReviewHint}
        </p>
      ) : doc?.status === "REJECTED" ? (
        <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {ui.rejectedBanner}
          {doc.rejectionReason ? (
            <>
              {" "}
              {ui.rejectionPrefix}: {doc.rejectionReason}
            </>
          ) : null}
        </p>
      ) : (
        <p className="mb-4 text-sm text-[var(--muted)]">{ui.pendingBanner}</p>
      )}

      {doc?.id && doc.originalFileName ? (
        <p className="mb-4 text-sm">
          <span className="text-[var(--muted)]">{ui.statusLabels[doc.status] ?? doc.status}</span>
          {" · "}
          {doc.originalFileName}
          {doc.documentNumber ? ` · ${doc.documentNumber}` : ""}
          {" · "}
          <a
            href={`/api/v1/affiliate/kyc/${encodeURIComponent(doc.id)}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            {ui.viewFile}
          </a>
        </p>
      ) : null}

      {canEdit && !approved ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">{ui.identityTypeLabel}</span>
            <select
              className={inputClass}
              value={identityKind}
              onChange={(e) => setIdentityKind(e.target.value as IdentityKind)}
            >
              <option value="NATIONAL_ID">{ui.identityTypeNationalId}</option>
              <option value="RESIDENCY">{ui.identityTypeResidency}</option>
              <option value="PASSPORT">{ui.identityTypePassport}</option>
              <option value="OTHER">{ui.identityTypeOther}</option>
            </select>
          </label>
          {identityKind === "OTHER" ? (
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">{ui.identityTypeOtherLabel}</span>
              <input
                className={inputClass}
                value={identityKindOther}
                onChange={(e) => setIdentityKindOther(e.target.value)}
              />
            </label>
          ) : null}
          <label className="block text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">{ui.documentNumberLabel}</span>
            <input
              className={inputClass}
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">{ui.photoLabel}</span>
            <p className="text-xs text-[var(--muted)]">{ui.photoHint}</p>
            <input
              type="file"
              accept={KYC_ACCEPT_ATTRIBUTE}
              className="mt-2 block w-full text-sm"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                if (next && !isAllowedKycFile(next)) {
                  toast.error(ui.uploadError);
                  e.target.value = "";
                  return;
                }
                setFile(next);
              }}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{file ? file.name : ui.noFileChosen}</p>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="button"
              className="btn-primary btn-press rounded-lg px-4 py-2 text-sm"
              disabled={uploading || !file}
              onClick={() => void uploadDocument()}
            >
              {uploading ? ui.uploadSubmitting : ui.uploadSubmit}
            </button>
            {canSubmit ? (
              <button
                type="button"
                className="btn-secondary btn-press rounded-lg px-4 py-2 text-sm"
                disabled={submitting}
                onClick={() => void submitForReview()}
              >
                {submitting ? ui.submitReviewing : ui.submitReview}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
