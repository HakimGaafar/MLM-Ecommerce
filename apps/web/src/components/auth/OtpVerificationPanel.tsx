"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Ui = {
  sendCode: string;
  sending: string;
  codeLabel: string;
  codePlaceholder: string;
  verify: string;
  verifying: string;
  resent: string;
  sendError: string;
  verifyError: string;
  invalidCode: string;
  loading: string;
};

export default function OtpVerificationPanel({
  ui,
  title,
  body,
  onVerified,
}: {
  ui: Ui;
  title: string;
  body: string;
  onVerified: () => void;
}) {
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/email-verification", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.sendError);
      const data = (await res.json()) as { emailVerified: boolean; maskedEmail: string };
      if (data.emailVerified) {
        onVerified();
        return;
      }
      setMaskedEmail(data.maskedEmail);
    } catch {
      setError(ui.sendError);
    } finally {
      setLoadingStatus(false);
    }
  }, [onVerified, ui.sendError]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function sendCode() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/email-verification", {
        method: "POST",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as
        | { maskedEmail?: string; error?: string }
        | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.sendError);
      setMaskedEmail(payload?.maskedEmail ?? maskedEmail);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ui.sendError);
    } finally {
      setSending(false);
    }
  }

  async function submitVerify(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.replace(/\D/g, "");
    if (trimmed.length !== 6) {
      setError(ui.invalidCode);
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/email-verification", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.verifyError);
      onVerified();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ui.verifyError);
    } finally {
      setVerifying(false);
    }
  }

  if (loadingStatus) {
    return (
      <section className="app-card mt-6 p-6">
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      </section>
    );
  }

  return (
    <section className="app-card mt-6 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
      {maskedEmail ? (
        <p className="mt-2 text-sm text-[var(--muted)]" dir="ltr">
          {maskedEmail}
        </p>
      ) : null}
      {sent ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{ui.resent}</p> : null}
      {error ? <p className="app-alert-error mt-3">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-secondary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={sending}
          onClick={() => void sendCode()}
        >
          {sending ? ui.sending : ui.sendCode}
        </button>
      </div>
      <form className="mt-5 space-y-3" onSubmit={submitVerify}>
        <label className="block text-sm font-medium" htmlFor="otp-verification-code">
          {ui.codeLabel}
        </label>
        <input
          id="otp-verification-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder={ui.codePlaceholder}
          className="app-input max-w-xs tracking-[0.3em]"
          dir="ltr"
        />
        <button
          type="submit"
          className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={verifying || code.length !== 6}
        >
          {verifying ? ui.verifying : ui.verify}
        </button>
      </form>
    </section>
  );
}
