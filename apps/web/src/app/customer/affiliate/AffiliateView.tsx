"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AffiliateProgramIntro,
  type AffiliateProgramRules,
} from "@/app/customer/affiliate/AffiliateProgramIntro";
import GenealogyTree from "@/components/affiliate/GenealogyTree";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { statusLabel } from "@/lib/status-label";
import en from "@/i8n/en.json";

type Locale = "en" | "ar";

type AffiliateState = {
  referralCode: string | null;
  isActive: boolean;
  canEditReferralCode: boolean;
  referralUseCount: number;
  parentUserId: string | null;
  rankTitle: string | null;
  internationalMarketingConsentAccepted: boolean;
};

type GenealogyNode = {
  userId: string;
  name: string;
  referralCode: string;
  rankTitle: string;
  depth: number;
  joinedAt: string;
  directReferrals: number;
  children: GenealogyNode[];
};

type DownlineRow = {
  userId: string;
  name: string;
  joinedAt: string;
};

type CommissionRow = {
  id: string;
  direction: string;
  amount: string;
  status: string;
  createdAt: string;
  displaySource: string | null;
  orderId: string | null;
  orderNo: string | null;
};

type Ui = (typeof en)["customerAffiliate"] & {
  statusLabels: Record<string, string>;
};

export default function AffiliateView({
  locale,
  ui,
  programRules,
  internationalNotice,
}: {
  locale: Locale;
  ui: Ui;
  programRules: AffiliateProgramRules;
  internationalNotice: {
    title: string;
    body: string;
    platformClause: string;
    agreement: string;
    accept: string;
    saving: string;
    error: string;
  } | null;
}) {
  const toast = useToast();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [affiliate, setAffiliate] = useState<AffiliateState | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [acceptInternationalMarketing, setAcceptInternationalMarketing] = useState(false);

  const pageSize = LIST_PAGE_SIZE;
  const [downline, setDownline] = useState<DownlineRow[]>([]);
  const [downlinePage, setDownlinePage] = useState(1);
  const [downlineTotal, setDownlineTotal] = useState(0);

  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [commissionPage, setCommissionPage] = useState(1);
  const [commissionTotal, setCommissionTotal] = useState(0);

  const [genealogyRoot, setGenealogyRoot] = useState<GenealogyNode | null>(null);
  const [genealogyTruncated, setGenealogyTruncated] = useState(false);

  const loadAffiliate = useCallback(async () => {
    const res = await fetch("/api/v1/referral/me", { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(ui.loadError);
    const data = (await res.json()) as AffiliateState & { referralCode: string | null };
    return {
      referralCode: data.referralCode ?? null,
      isActive: Boolean(data.isActive),
      canEditReferralCode: Boolean(data.canEditReferralCode),
      referralUseCount: Number(data.referralUseCount ?? 0),
      parentUserId: data.parentUserId ?? null,
      rankTitle: (data as { rankTitle?: string | null }).rankTitle ?? null,
      internationalMarketingConsentAccepted: Boolean(
        data.internationalMarketingConsentAccepted,
      ),
    };
  }, [ui.loadError]);

  const loadGenealogy = useCallback(async () => {
    const res = await fetch("/api/v1/affiliate/genealogy?depth=3", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { root: GenealogyNode | null; truncated: boolean };
    setGenealogyRoot(data.root);
    setGenealogyTruncated(Boolean(data.truncated));
  }, []);

  const loadDownlinePage = useCallback(
    async (pageNum: number) => {
      const res = await fetch(
        `/api/v1/affiliate/downline?page=${pageNum}&pageSize=${pageSize}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: DownlineRow[]; total: number };
      setDownline(data.items);
      setDownlineTotal(data.total);
      setDownlinePage(pageNum);
    },
    [pageSize, ui.loadError],
  );

  const loadCommissionPage = useCallback(
    async (pageNum: number) => {
      const res = await fetch(
        `/api/v1/affiliate/commissions?page=${pageNum}&pageSize=${pageSize}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: CommissionRow[]; total: number };
      setCommissions(data.items);
      setCommissionTotal(data.total);
      setCommissionPage(pageNum);
    },
    [pageSize, ui.loadError],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const state = await loadAffiliate();
        if (cancelled) return;
        setAffiliate(state);
        if (
          state.isActive &&
          state.referralCode &&
          (!internationalNotice || state.internationalMarketingConsentAccepted)
        ) {
          await Promise.all([
            loadDownlinePage(1),
            loadCommissionPage(1),
            loadGenealogy(),
          ]);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : ui.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    internationalNotice,
    loadAffiliate,
    loadDownlinePage,
    loadCommissionPage,
    loadGenealogy,
    ui.loadError,
  ]);

  const acceptInternationalNotice = async () => {
    if (!acceptInternationalMarketing) return;
    setEnrolling(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/referral/me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internationalMarketingConsent: true }),
      });
      if (!res.ok) throw new Error(internationalNotice?.error ?? ui.enrollError);
      const state = await loadAffiliate();
      setAffiliate(state);
      await Promise.all([
        loadDownlinePage(1),
        loadCommissionPage(1),
        loadGenealogy(),
      ]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : internationalNotice?.error ?? ui.enrollError,
      );
    } finally {
      setEnrolling(false);
    }
  };

  const becomeAffiliate = async () => {
    setEnrolling(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/referral/me", {
        method: "POST",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.enrollError);
      const state = await loadAffiliate();
      setAffiliate(state);
      if (state.isActive && state.referralCode) {
        await Promise.all([
          loadDownlinePage(1),
          loadCommissionPage(1),
          loadGenealogy(),
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.enrollError);
    } finally {
      setEnrolling(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(ui.copied);
    } catch {
      toast.error(ui.copyError);
    }
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  const shareLink =
    typeof window !== "undefined" && affiliate?.referralCode
      ? `${window.location.origin}/register?ref=${affiliate.referralCode}`
      : "";

  if (loading) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (
    internationalNotice &&
    !affiliate?.internationalMarketingConsentAccepted
  ) {
    return (
      <section
        dir={direction}
        className="mt-8 rounded-xl border border-amber-400/50 bg-amber-400/10 p-6"
      >
        <h2 className="text-xl font-semibold">{internationalNotice.title}</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          {internationalNotice.body}
        </p>
        <p className="mt-3 text-sm font-medium">{internationalNotice.platformClause}</p>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={acceptInternationalMarketing}
            onChange={(event) => setAcceptInternationalMarketing(event.target.checked)}
          />
          <span>{internationalNotice.agreement}</span>
        </label>
        {error ? <p className="mt-3 app-alert-error">{error}</p> : null}
        <button
          type="button"
          className="btn-primary mt-5"
          disabled={!acceptInternationalMarketing || enrolling}
          onClick={() => void acceptInternationalNotice()}
        >
          {enrolling ? internationalNotice.saving : internationalNotice.accept}
        </button>
      </section>
    );
  }

  const isEnrolled = Boolean(affiliate?.isActive && affiliate.referralCode);
  const hasProgramExperience =
    isEnrolled &&
    (affiliate!.referralUseCount > 0 || affiliate!.parentUserId != null);
  const introVariant = hasProgramExperience ? "compact" : "promo";

  return (
    <div dir={direction} className="mt-8 space-y-8">
      {error ? <p className="app-alert-error">{error}</p> : null}

      <AffiliateProgramIntro
        variant={introVariant}
        rules={programRules}
        locale={locale}
        ui={ui}
      />

      {!isEnrolled ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold">{ui.enrollTitle}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--muted)]">{ui.enrollBody}</p>
          <button
            type="button"
            disabled={enrolling}
            onClick={() => void becomeAffiliate()}
            className="btn-primary btn-press mt-5 rounded-md px-5 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {enrolling ? ui.enrolling : ui.enrollCta}
          </button>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  {ui.codeLabel}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tracking-wide">
                  {affiliate!.referralCode}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {ui.useCount.replace("{count}", String(affiliate!.referralUseCount))}
                </p>
                {affiliate!.rankTitle ? (
                  <p className="mt-2 text-sm">
                    <span className="text-[var(--muted)]">{ui.rankLabel}: </span>
                    <span className="font-medium">{affiliate!.rankTitle}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-neutral rounded-md px-3 py-1.5 text-sm"
                  onClick={() => void copyText(affiliate!.referralCode ?? "")}
                >
                  {ui.copyCode}
                </button>
                <button
                  type="button"
                  className="btn-neutral rounded-md px-3 py-1.5 text-sm"
                  onClick={() => void copyText(shareLink)}
                >
                  {ui.copyLink}
                </button>
              </div>
            </div>
            <p className="mt-4 break-all text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">{ui.linkLabel}: </span>
              {shareLink}
            </p>
            <p className="mt-3 flex flex-wrap gap-4 text-sm">
              <Link href="/profile" className="font-medium text-link">
                {ui.profileLink}
              </Link>
              <Link href="/cashback" className="font-medium text-link">
                {ui.walletLink}
              </Link>
              <Link href="/kyc" className="font-medium text-link">
                {ui.kycLink}
              </Link>
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">{ui.withdrawHint}</p>
          </section>

          <p className="app-card px-4 py-3 text-sm text-[var(--muted)]">{ui.globalTreeHint}</p>

          <section>
            <h2 className="text-lg font-semibold">{ui.genealogyTitle}</h2>
            {genealogyTruncated ? (
              <p className="mt-1 text-xs text-[var(--muted)]">{ui.genealogyTruncated}</p>
            ) : null}
            {genealogyRoot ? (
              <div className="mt-4">
                <GenealogyTree
                  root={genealogyRoot}
                  locale={locale}
                  labels={{
                    level: ui.genealogy.level,
                    referrals: ui.genealogy.referrals,
                    emptyChildren: ui.genealogy.emptyChildren,
                  }}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">{ui.genealogyEmpty}</p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold">{ui.downlineTitle}</h2>
            {downline.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">{ui.downlineEmpty}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="min-w-full text-start text-sm">
                  <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">{ui.colName}</th>
                      <th className="px-4 py-3 font-medium">{ui.colJoined}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downline.map((row) => (
                      <tr key={row.userId} className="border-b border-[var(--table-row-border)]">
                        <td className="px-4 py-3">{row.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                          {formatDate(row.joinedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {downline.length > 0 ? (
              <Pagination
                page={downlinePage}
                total={downlineTotal}
                pageSize={pageSize}
                onPageChange={(p) => void loadDownlinePage(p)}
                labels={getPaginationLabels(locale)}
                className="mt-4"
              />
            ) : null}
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{ui.commissionsTitle}</h2>
              <Link href="/cashback" className="text-sm font-medium text-link">
                {ui.walletLink}
              </Link>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{ui.commissionsWalletHint}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{ui.commissionsMarketHint}</p>
            {commissions.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">{ui.commissionsEmpty}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="min-w-full text-start text-sm">
                  <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">{ui.colDate}</th>
                      <th className="px-4 py-3 font-medium">{ui.colSource}</th>
                      <th className="px-4 py-3 font-medium">{ui.colAmount}</th>
                      <th className="px-4 py-3 font-medium">{ui.colStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((row) => {
                      const sign = row.direction === "CREDIT" ? "+" : "−";
                      return (
                        <tr key={row.id} className="border-b border-[var(--table-row-border)]">
                          <td className="whitespace-nowrap px-4 py-3">{formatDate(row.createdAt)}</td>
                          <td className="px-4 py-3">
                            {row.displaySource ?? row.orderNo ?? "—"}
                            <span className="mt-0.5 block text-xs text-[var(--muted)]">
                              {row.direction === "CREDIT" ? ui.directionCredit : ui.directionDebit}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium tabular-nums">
                            {sign}
                            {formatMoney(row.amount, programRules.currency, locale)}
                          </td>
                          <td className="px-4 py-3">{statusLabel(row.status, ui.statusLabels)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {commissions.length > 0 ? (
              <Pagination
                page={commissionPage}
                total={commissionTotal}
                pageSize={pageSize}
                onPageChange={(p) => void loadCommissionPage(p)}
                labels={getPaginationLabels(locale)}
                className="mt-4"
              />
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
