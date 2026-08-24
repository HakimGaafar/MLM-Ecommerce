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
  phoneLabel: string;
  phonePlaceholder: string;
  disabledNotice: string;
  verifiedNotice: string;
};

export default function PhoneVerificationPanel({ ui }: { ui: Ui }) {
  const [enabled, setEnabled] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phone, setPhone] = useState("");
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/phone-verification", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.sendError);
      const data = (await res.json()) as {
        enabled: boolean;
        phoneVerified: boolean;
        phone?: string | null;
        maskedPhone?: string | null;
      };
      setEnabled(data.enabled);
      setPhoneVerified(data.phoneVerified);
      setPhone(data.phone ?? "");
      setMaskedPhone(data.maskedPhone ?? null);
    } catch {
      setError(ui.sendError);
    } finally {
      setLoadingStatus(false);
    }
  }, [ui.sendError]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function sendCode() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/phone-verification", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { maskedPhone?: string; error?: string; previewCode?: string }
        | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.sendError);
      setMaskedPhone(payload?.maskedPhone ?? maskedPhone);
      setPreviewCode(payload?.previewCode ?? null);
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
      const res = await fetch("/api/v1/auth/phone-verification", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.verifyError);
      setPhoneVerified(true);
      setPreviewCode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ui.verifyError);
    } finally {
      setVerifying(false);
    }
  }

  if (loadingStatus) {
    return (
      <section className="app-card mt-8 p-6">
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      </section>
    );
  }

  if (!enabled) {
    return (
      <section className="app-card mt-8 p-6">
        <p className="text-sm text-[var(--muted)]">{ui.disabledNotice}</p>
      </section>
    );
  }

  if (phoneVerified) {
    return (
      <section className="app-card mt-8 p-6">
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {ui.verifiedNotice.replace("{phone}", maskedPhone ?? phone)}
        </p>
      </section>
    );
  }

  return (
    <section className="app-card mt-8 p-6">
      <label className="block text-sm font-medium" htmlFor="phone-verification-number">
        {ui.phoneLabel}
      </label>
      <input
        id="phone-verification-number"
        className="app-input mt-2 max-w-sm"
        dir="ltr"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder={ui.phonePlaceholder}
      />
      {maskedPhone ? (
        <p className="mt-2 text-sm text-[var(--muted)]" dir="ltr">
          {maskedPhone}
        </p>
      ) : null}
      {sent ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{ui.resent}</p> : null}
      {previewCode ? (
        <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" dir="ltr">
          Dev preview code: <strong className="tracking-[0.2em]">{previewCode}</strong>
        </p>
      ) : null}
      {error ? <p className="app-alert-error mt-3">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-secondary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={sending || phone.trim().length < 8}
          onClick={() => void sendCode()}
        >
          {sending ? ui.sending : ui.sendCode}
        </button>
      </div>
      <form className="mt-5 space-y-3" onSubmit={submitVerify}>
        <label className="block text-sm font-medium" htmlFor="phone-verification-code">
          {ui.codeLabel}
        </label>
        <input
          id="phone-verification-code"
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
