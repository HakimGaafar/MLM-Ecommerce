"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast/ToastProvider";
import { isAllowedKycFile, KYC_ACCEPT_ATTRIBUTE } from "@/lib/kyc-storage/mime";

type Locale = "en" | "ar";

type KycDocumentRow = {
  id: string;
  documentType: string;
  status: string;
  originalFileName: string | null;
  documentExpiresAt: string | null;
  ibanNumber: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  expiryWarning?: string;
  updateRequestedAt?: string | null;
};

type KycAdminUpdateRequest = {
  documentType: string;
  message: string | null;
};

type KycSummary = {
  approved: boolean;
  idExpired: boolean;
  documents: KycDocumentRow[];
  adminUpdateRequests?: KycAdminUpdateRequest[];
};

type Ui = {
  loading: string;
  loadError: string;
  loginRequired: string;
  loginLink: string;
  approvedBanner: string;
  expiredBanner: string;
  pendingBanner: string;
  documentTypes: Record<string, string>;
  statusLabels: Record<string, string>;
  uploadLabel: string;
  uploadHint: string;
  expiryLabel: string;
  ibanLabel: string;
  chooseFile: string;
  noFileChosen: string;
  allowedTypesHint: string;
  invalidFileType: string;
  uploadSubmit: string;
  uploadSubmitting: string;
  submitReview: string;
  submitReviewing: string;
  cancelUpload: string;
  cancelUploading: string;
  cancelUploadSuccess: string;
  viewFile: string;
  uploadSuccess: string;
  submitSuccess: string;
  uploadError: string;
  rejectionPrefix: string;
  replaceHint: string;
  replaceSubmit: string;
  pendingReviewHint: string;
  replaceConfirmTitle: string;
  replaceConfirmMessage: string;
  replaceConfirmYes: string;
  replaceConfirmCancel: string;
  adminUpdateBannerTitle: string;
  adminUpdateBannerItem: string;
  expiryWarningMonth: string;
  expiryWarningWeek: string;
};

const ID_TYPES = new Set(["NATIONAL_ID", "REPRESENTATIVE_ID"]);

function statusChipClass(status: string): string {
  switch (status) {
    case "ACCEPTED":
      return "border-emerald-500/50 bg-emerald-500/15 text-emerald-200";
    case "PENDING_REVIEW":
      return "border-amber-500/50 bg-amber-500/15 text-amber-200";
    case "REJECTED":
    case "EXPIRED":
      return "border-red-500/50 bg-red-500/15 text-red-200";
    case "UPLOADED":
      return "border-sky-500/50 bg-sky-500/15 text-sky-200";
    default:
      return "border-[var(--border)] bg-[var(--background)] text-[var(--muted)]";
  }
}

function expiryWarningChipClass(warning: string): string {
  if (warning === "week") return "border-red-500/50 bg-red-500/15 text-red-200";
  if (warning === "month") return "border-amber-500/50 bg-amber-500/15 text-amber-200";
  return "";
}

function expiryWarningLabel(warning: string, ui: Ui): string | null {
  if (warning === "week") return ui.expiryWarningWeek;
  if (warning === "month") return ui.expiryWarningMonth;
  return null;
}

export default function KycDocumentsPanel({
  apiBase,
  locale,
  ui,
}: {
  apiBase: string;
  locale: Locale;
  ui: Ui;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const toast = useToast();
  const [summary, setSummary] = useState<KycSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [ibanValues, setIbanValues] = useState<Record<string, string>>({});
  const [replaceConfirm, setReplaceConfirm] = useState<{
    documentType: string;
    documentLabel: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsLogin(false);
    try {
      const res = await fetch(apiBase, { credentials: "include", cache: "no-store" });
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { summary: KycSummary };
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [apiBase, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!summary) return;
    const nextExpiry: Record<string, string> = {};
    const nextIban: Record<string, string> = {};
    for (const doc of summary.documents) {
      if (doc.documentExpiresAt) {
        nextExpiry[doc.documentType] = doc.documentExpiresAt.slice(0, 10);
      }
      if (doc.ibanNumber) {
        nextIban[doc.documentType] = doc.ibanNumber;
      }
    }
    setExpiryDates((prev) => ({ ...nextExpiry, ...prev }));
    setIbanValues((prev) => ({ ...nextIban, ...prev }));
  }, [summary]);

  const formatDate = useMemo(
    () => (iso: string | null) => {
      if (!iso) return "—";
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
        dateStyle: "medium",
      }).format(new Date(iso));
    },
    [locale],
  );

  async function uploadDocument(documentType: string) {
    const file = files[documentType];
    if (!file) {
      toast.error(ui.noFileChosen);
      return;
    }

    setBusyType(`upload:${documentType}`);
    try {
      const form = new FormData();
      form.set("documentType", documentType);
      form.set("file", file);
      if (ID_TYPES.has(documentType) && expiryDates[documentType]) {
        form.set("documentExpiresAt", expiryDates[documentType]);
      }
      if (documentType === "IBAN" && ibanValues[documentType]) {
        form.set("ibanNumber", ibanValues[documentType]);
      }

      const res = await fetch(apiBase, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.uploadError);

      toast.success(ui.uploadSuccess);
      setFiles((prev) => ({ ...prev, [documentType]: null }));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.uploadError);
    } finally {
      setBusyType(null);
    }
  }

  async function submitForReview(doc: KycDocumentRow) {
    if (!doc.id) return;
    setBusyType(`submit:${doc.documentType}`);
    try {
      const res = await fetch(`${apiBase}/${doc.id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.uploadError);
      toast.success(ui.submitSuccess);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.uploadError);
    } finally {
      setBusyType(null);
    }
  }

  async function cancelUpload(doc: KycDocumentRow) {
    if (!doc.id) return;
    setBusyType(`cancel:${doc.documentType}`);
    try {
      const res = await fetch(`${apiBase}/${doc.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        summary?: KycSummary;
      } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.uploadError);
      if (payload?.summary) setSummary(payload.summary);
      else await load();
      setFiles((prev) => ({ ...prev, [doc.documentType]: null }));
      toast.success(ui.cancelUploadSuccess);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.uploadError);
    } finally {
      setBusyType(null);
    }
  }

  function canUpload(status: string) {
    return (
      status === "NOT_UPLOADED" ||
      status === "REJECTED" ||
      status === "EXPIRED" ||
      status === "ACCEPTED"
    );
  }

  function handleFileSelected(documentType: string, file: File | null) {
    if (!file) {
      setFiles((prev) => ({ ...prev, [documentType]: null }));
      return;
    }
    if (!isAllowedKycFile(file)) {
      toast.error(ui.invalidFileType);
      setFiles((prev) => ({ ...prev, [documentType]: null }));
      return;
    }
    setFiles((prev) => ({ ...prev, [documentType]: file }));
  }

  function requestUpload(documentType: string, status: string, documentLabel: string) {
    const file = files[documentType];
    if (!file) {
      toast.error(ui.noFileChosen);
      return;
    }
    if (status === "ACCEPTED") {
      setReplaceConfirm({ documentType, documentLabel });
      return;
    }
    void uploadDocument(documentType);
  }

  function uploadHintFor(status: string) {
    return status === "ACCEPTED" ? ui.replaceHint : null;
  }

  return (
    <div dir={direction} className="space-y-4">
      {loading ? <p className="text-sm text-[var(--muted)]">{ui.loading}</p> : null}
      {needsLogin ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm">
          <p className="text-amber-100">{ui.loginRequired}</p>
          <a href="/login" className="mt-3 inline-block text-sm font-medium text-link">
            {ui.loginLink}
          </a>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {summary?.approved ? (
        <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
          {ui.approvedBanner}
        </div>
      ) : null}

      {summary?.idExpired ? (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
          {ui.expiredBanner}
        </div>
      ) : null}

      {!summary?.approved && summary && !summary.idExpired ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {ui.pendingBanner}
        </div>
      ) : null}

      {(summary?.adminUpdateRequests?.length ?? 0) > 0 ? (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">{ui.adminUpdateBannerTitle}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            {summary!.adminUpdateRequests!.map((req) => (
              <li key={req.documentType}>
                {ui.adminUpdateBannerItem
                  .replace("{document}", ui.documentTypes[req.documentType] ?? req.documentType)
                  .replace("{message}", req.message?.trim() ? req.message : "—")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="space-y-4">
        {(summary?.documents ?? []).map((doc) => (
          <li key={doc.documentType} className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{ui.documentTypes[doc.documentType] ?? doc.documentType}</h3>
              <div className="flex flex-wrap items-center gap-2">
                {doc.expiryWarning && expiryWarningLabel(doc.expiryWarning, ui) ? (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${expiryWarningChipClass(doc.expiryWarning)}`}
                  >
                    {expiryWarningLabel(doc.expiryWarning, ui)}
                  </span>
                ) : null}
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusChipClass(doc.status)}`}>
                  {ui.statusLabels[doc.status] ?? doc.status}
                </span>
              </div>
            </div>

            {doc.ibanNumber ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                {ui.ibanLabel}: <span className="font-mono text-[var(--foreground)]">{doc.ibanNumber}</span>
              </p>
            ) : null}

            {doc.documentExpiresAt ? (
              <p className="mt-1 text-sm text-[var(--muted)]">
                {ui.expiryLabel}: {formatDate(doc.documentExpiresAt)}
              </p>
            ) : null}

            {doc.rejectionReason ? (
              <p className="mt-2 text-sm text-red-400">
                {ui.rejectionPrefix}: {doc.rejectionReason}
              </p>
            ) : null}

            {doc.id && doc.originalFileName ? (
              <p className="mt-2 text-xs text-[var(--muted)]">{doc.originalFileName}</p>
            ) : null}

            {doc.status === "PENDING_REVIEW" ? (
              <p className="mt-2 text-sm text-amber-200">{ui.pendingReviewHint}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {doc.id && doc.status !== "NOT_UPLOADED" ? (
                <a
                  href={`${apiBase}/${doc.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary btn-press text-xs"
                >
                  {ui.viewFile}
                </a>
              ) : null}

              {doc.id && doc.status === "UPLOADED" ? (
                <>
                  <button
                    type="button"
                    className="btn-press rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                    disabled={busyType === `cancel:${doc.documentType}`}
                    onClick={() => void cancelUpload(doc)}
                  >
                    {busyType === `cancel:${doc.documentType}` ? ui.cancelUploading : ui.cancelUpload}
                  </button>
                  <button
                    type="button"
                    className="btn-primary btn-press text-xs"
                    disabled={busyType === `submit:${doc.documentType}`}
                    onClick={() => void submitForReview(doc)}
                  >
                    {busyType === `submit:${doc.documentType}` ? ui.submitReviewing : ui.submitReview}
                  </button>
                </>
              ) : null}
            </div>

            {canUpload(doc.status) ? (
              <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                {uploadHintFor(doc.status) ? (
                  <p className="text-xs text-[var(--muted)]">{uploadHintFor(doc.status)}</p>
                ) : null}
                <p className="text-xs text-amber-200/90">{ui.allowedTypesHint}</p>

                {doc.documentType === "IBAN" ? (
                  <label className="block text-sm">
                    <span className="text-[var(--muted)]">{ui.ibanLabel}</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      value={ibanValues[doc.documentType] ?? ""}
                      onChange={(e) =>
                        setIbanValues((prev) => ({ ...prev, [doc.documentType]: e.target.value }))
                      }
                      placeholder="SA…"
                      disabled={doc.status === "ACCEPTED"}
                    />
                  </label>
                ) : null}

                {ID_TYPES.has(doc.documentType) ? (
                  <label className="block text-sm">
                    <span className="text-[var(--muted)]">{ui.expiryLabel}</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      value={expiryDates[doc.documentType] ?? ""}
                      onChange={(e) =>
                        setExpiryDates((prev) => ({ ...prev, [doc.documentType]: e.target.value }))
                      }
                      disabled={doc.status === "ACCEPTED"}
                    />
                  </label>
                ) : null}

                <div className="flex flex-wrap items-stretch gap-2">
                  <input
                    id={`kyc-file-${doc.documentType}`}
                    type="file"
                    accept={KYC_ACCEPT_ATTRIBUTE}
                    className="sr-only"
                    onChange={(e) => {
                      handleFileSelected(doc.documentType, e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary btn-press min-w-0 flex-1 truncate px-3 py-2 text-left text-xs sm:max-w-md"
                    onClick={() => document.getElementById(`kyc-file-${doc.documentType}`)?.click()}
                  >
                    <span className="font-medium">{ui.chooseFile}</span>
                    <span className="mx-1.5 text-[var(--muted)]">·</span>
                    <span className="text-[var(--muted)]">
                      {files[doc.documentType]?.name ?? ui.noFileChosen}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary btn-press shrink-0 px-4 py-2 text-xs"
                    disabled={!files[doc.documentType] || busyType === `upload:${doc.documentType}`}
                    onClick={() =>
                      requestUpload(
                        doc.documentType,
                        doc.status,
                        ui.documentTypes[doc.documentType] ?? doc.documentType,
                      )
                    }
                  >
                    {busyType === `upload:${doc.documentType}` ? ui.uploadSubmitting : ui.uploadSubmit}
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={replaceConfirm !== null}
        title={ui.replaceConfirmTitle}
        message={ui.replaceConfirmMessage.replace(
          "{document}",
          replaceConfirm?.documentLabel ?? "",
        )}
        confirmLabel={ui.replaceConfirmYes}
        cancelLabel={ui.replaceConfirmCancel}
        confirming={replaceConfirm !== null && busyType === `upload:${replaceConfirm.documentType}`}
        confirmingLabel={ui.uploadSubmitting}
        onCancel={() => setReplaceConfirm(null)}
        onConfirm={() => {
          if (!replaceConfirm) return;
          void uploadDocument(replaceConfirm.documentType).finally(() => setReplaceConfirm(null));
        }}
      />
    </div>
  );
}
