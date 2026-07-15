"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";

type Preview = {
  storeName: string;
  email: string;
  status: string;
};

type Ui = {
  loading: string;
  loadError: string;
  invalidToken: string;
  invitedTo: string;
  emailLabel: string;
  accept: string;
  accepting: string;
  acceptSuccess: string;
  loginRequired: string;
  login: string;
  goDashboard: string;
  alreadyActive: string;
  revoked: string;
};

export default function AcceptTeamInvite({
  token,
  locale,
  ui,
}: {
  token: string;
  locale: Locale;
  ui: Ui;
}) {
  const router = useRouter();
  const toast = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    if (!token.trim()) {
      setError(ui.invalidToken);
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/public/vendor-invites/${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error(ui.invalidToken);
      setPreview((await res.json()) as Preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [token, ui.invalidToken, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept() {
    if (!token || accepting) return;
    setAccepting(true);
    try {
      const res = await fetch("/api/v1/vendor/team/accept", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; storeName?: string } | null;
      if (res.status === 401) {
        setError(ui.loginRequired);
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error ?? ui.loadError);
      }
      toast.success(ui.acceptSuccess.replace("{store}", data?.storeName ?? ""));
      router.push("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setAccepting(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  if (error && !preview) return <p className="text-sm text-red-600">{error}</p>;
  if (!preview) return null;

  if (preview.status === "REVOKED") {
    return <p className="text-sm text-red-600">{ui.revoked}</p>;
  }
  if (preview.status === "ACTIVE") {
    return (
      <div className="app-card p-4">
        <p className="text-sm">{ui.alreadyActive}</p>
        <Link href="/dashboard" className="btn-primary mt-4 inline-block">
          {ui.goDashboard}
        </Link>
      </div>
    );
  }

  return (
    <div className="app-card space-y-4 p-4 sm:p-6">
      <p className="text-sm text-[var(--muted)]">{ui.invitedTo}</p>
      <p className="text-lg font-semibold">{preview.storeName}</p>
      <p className="text-sm">
        <span className="text-[var(--muted)]">{ui.emailLabel}: </span>
        {preview.email}
      </p>
      {error === ui.loginRequired ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">{ui.loginRequired}</p>
      ) : null}
      <button type="button" className="btn-primary w-full" disabled={accepting} onClick={() => void accept()}>
        {accepting ? ui.accepting : ui.accept}
      </button>
    </div>
  );
}
