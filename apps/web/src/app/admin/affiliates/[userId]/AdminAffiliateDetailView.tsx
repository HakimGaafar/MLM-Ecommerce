"use client";

import { useCallback, useEffect, useState } from "react";
import GenealogyTree from "@/components/affiliate/GenealogyTree";
import AdminPendingSettlementsPanel, {
  type AdminPendingSettlementsUi,
} from "@/components/admin/AdminPendingSettlementsPanel";
import { formatMoney } from "@/lib/format-currency";

type Locale = "en" | "ar";

type Detail = {
  userId: string;
  name: string;
  email: string;
  referralCode: string;
  rankTitle: string;
  sponsorName: string | null;
  directReferrals: number;
  commissionPending: string;
  commissionApproved: string;
};

type GenealogyRoot = {
  userId: string;
  name: string;
  referralCode: string;
  rankTitle: string;
  depth: number;
  joinedAt: string;
  directReferrals: number;
  children: GenealogyRoot[];
};

type Ui = {
  loadError: string;
  loading: string;
  saveError: string;
  saving: string;
  saveRank: string;
  code: string;
  sponsor: string;
  referrals: string;
  pending: string;
  approved: string;
  rank: string;
  genealogyTitle: string;
  genealogyTruncated: string;
  genealogyEmpty: string;
  genealogy: { level: string; referrals: string; emptyChildren: string };
};

export default function AdminAffiliateDetailView({
  userId,
  locale,
  ui,
  ranks,
  settlementsUi,
}: {
  userId: string;
  locale: Locale;
  ui: Ui;
  ranks: readonly string[];
  settlementsUi: AdminPendingSettlementsUi;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [genealogy, setGenealogy] = useState<GenealogyRoot | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [rankTitle, setRankTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailRes, treeRes] = await Promise.all([
        fetch(`/api/v1/admin/affiliates/${userId}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/v1/admin/affiliates/${userId}/genealogy?depth=3`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      if (!detailRes.ok) throw new Error(ui.loadError);
      const detailData = (await detailRes.json()) as { detail: Detail };
      setDetail(detailData.detail);
      setRankTitle(detailData.detail.rankTitle);

      if (treeRes.ok) {
        const treeData = (await treeRes.json()) as { root: GenealogyRoot | null; truncated: boolean };
        setGenealogy(treeData.root);
        setTruncated(treeData.truncated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [userId, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveRank = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/affiliates/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankTitle }),
      });
      if (!res.ok) throw new Error(ui.saveError);
      const data = (await res.json()) as { detail: Detail };
      setDetail(data.detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  if (!detail) return <p className="mt-8 app-alert-error">{error ?? ui.loadError}</p>;

  return (
    <div dir={direction} className="mt-8 space-y-8">
      {error ? <p className="app-alert-error">{error}</p> : null}

      <section className="app-card p-5">
        <h2 className="text-lg font-semibold">{detail.name}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{detail.email}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">{ui.code}</dt>
            <dd className="font-mono font-medium">{detail.referralCode}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.sponsor}</dt>
            <dd>{detail.sponsorName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.referrals}</dt>
            <dd className="tabular-nums">{detail.directReferrals}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.pending}</dt>
            <dd className="tabular-nums">{formatMoney(detail.commissionPending, "SAR", locale)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">{ui.approved}</dt>
            <dd className="tabular-nums">{formatMoney(detail.commissionApproved, "SAR", locale)}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="font-medium">{ui.rank}</span>
            <select
              className="app-input mt-1 min-w-[10rem]"
              value={rankTitle}
              onChange={(e) => setRankTitle(e.target.value)}
            >
              {ranks.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={saving}
            className="btn-primary text-sm"
            onClick={() => void saveRank()}
          >
            {saving ? ui.saving : ui.saveRank}
          </button>
        </div>
      </section>

      <AdminPendingSettlementsPanel
        locale={locale}
        ui={settlementsUi}
        userId={userId}
        compact
      />

      <section>
        <h2 className="text-lg font-semibold">{ui.genealogyTitle}</h2>
        {truncated ? <p className="mt-1 text-xs text-[var(--muted)]">{ui.genealogyTruncated}</p> : null}
        <div className="mt-4">
          {genealogy ? (
            <GenealogyTree root={genealogy} locale={locale} labels={ui.genealogy} />
          ) : (
            <p className="text-sm text-[var(--muted)]">{ui.genealogyEmpty}</p>
          )}
        </div>
      </section>
    </div>
  );
}
