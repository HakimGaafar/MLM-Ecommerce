"use client";

import {
  VANDSOQ_WAREHOUSE_IDS,
  MARKET_IDS,
  MARKET_LAUNCH_ACTIVE,
  defaultCurrencyForMarketId,
  type MarketCode,
} from "@mlm/shared";

export type OfferDraft = {
  marketId: string;
  enabled: boolean;
  price: string;
  currency: string;
  secondaryPrice?: string | null;
  secondaryCurrency?: string | null;
  stockLocation: "MERCHANT" | "VANDSOQ_WAREHOUSE";
  vandsoqMode: "FORSEIZ_STOCK" | "ON_ORDER";
  quantity: string;
  status?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
};

const ALL_MARKET_OPTIONS = [
  { id: MARKET_IDS.SA, code: "SA" as const, warehouseId: VANDSOQ_WAREHOUSE_IDS.SA },
  { id: MARKET_IDS.OM, code: "OM" as const, warehouseId: VANDSOQ_WAREHOUSE_IDS.OM },
  { id: MARKET_IDS.EG, code: "EG" as const, warehouseId: VANDSOQ_WAREHOUSE_IDS.EG },
  { id: MARKET_IDS.GLOBAL, code: "GLOBAL" as const, warehouseId: null },
];

function launchVisibleOptions(activeMarketIds?: string[]) {
  if (activeMarketIds && activeMarketIds.length > 0) {
    const allow = new Set(activeMarketIds);
    return ALL_MARKET_OPTIONS.filter((m) => allow.has(m.id));
  }
  return ALL_MARKET_OPTIONS.filter((m) => MARKET_LAUNCH_ACTIVE[m.code as MarketCode]);
}

export function createDefaultOfferDrafts(
  homeMarketId?: string,
  activeMarketIds?: string[],
): OfferDraft[] {
  return launchVisibleOptions(activeMarketIds).map((m) => ({
    marketId: m.id,
    enabled: m.id === (homeMarketId ?? MARKET_IDS.SA),
    price: "",
    currency: defaultCurrencyForMarketId(m.id),
    stockLocation: "MERCHANT",
    vandsoqMode: "FORSEIZ_STOCK",
    quantity: "0",
  }));
}

type Labels = {
  title: string;
  subtitle: string;
  marketSA: string;
  marketOM: string;
  marketEG: string;
  marketGLOBAL: string;
  price: string;
  currency: string;
  secondaryOmrHint?: string;
  quantity: string;
  stockLocation: string;
  stockMerchant: string;
  stockMerchantHint: string;
  stockVandsoq: string;
  stockVandsoqHint: string;
  stockVandsoqUnavailable: string;
  vandsoqMode: string;
  vandsoqStockA: string;
  vandsoqStockAHint: string;
  vandsoqStockB: string;
  vandsoqStockBHint: string;
  statusDraft?: string;
  statusPending?: string;
  statusApproved?: string;
  statusRejected?: string;
};

export default function MarketOffersEditor({
  drafts,
  onChange,
  labels,
  activeMarketIds,
}: {
  drafts: OfferDraft[];
  onChange: (next: OfferDraft[]) => void;
  labels: Labels;
  activeMarketIds?: string[];
}) {
  const nameFor = (code: string) => {
    if (code === "SA") return labels.marketSA;
    if (code === "OM") return labels.marketOM;
    if (code === "EG") return labels.marketEG;
    return labels.marketGLOBAL;
  };

  function update(marketId: string, patch: Partial<OfferDraft>) {
    onChange(drafts.map((d) => (d.marketId === marketId ? { ...d, ...patch } : d)));
  }

  const visibleIds = new Set<string>(launchVisibleOptions(activeMarketIds).map((m) => m.id));
  const visibleDrafts = drafts.filter((d) => visibleIds.has(d.marketId));

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_4%,var(--surface))] p-4">
      <div>
        <h2 className="text-sm font-semibold">{labels.title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{labels.subtitle}</p>
      </div>
      <div className="space-y-3">
        {visibleDrafts.map((draft) => {
          const meta = ALL_MARKET_OPTIONS.find((m) => m.id === draft.marketId)!;
          const vandsoqAllowed = Boolean(meta.warehouseId);
          return (
            <article
              key={draft.marketId}
              className={`rounded-xl border bg-[var(--surface)] p-3 transition ${
                draft.enabled
                  ? "border-[color-mix(in_srgb,var(--primary)_40%,var(--border))] shadow-sm"
                  : "border-[var(--border)] opacity-80"
              }`}
            >
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => update(draft.marketId, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span className="text-sm font-semibold">{nameFor(meta.code)}</span>
                {draft.status ? (
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[var(--muted)] dark:bg-white/10">
                    {draft.status === "APPROVED"
                      ? labels.statusApproved ?? "Approved"
                      : draft.status === "PENDING"
                        ? labels.statusPending ?? "Pending"
                        : draft.status === "REJECTED"
                          ? labels.statusRejected ?? "Rejected"
                          : labels.statusDraft ?? "Draft"}
                  </span>
                ) : null}
                <span className="ms-auto rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[var(--muted)] dark:bg-white/10">
                  {draft.currency}
                </span>
              </label>
              {draft.status === "REJECTED" && draft.rejectionReason ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{draft.rejectionReason}</p>
              ) : null}

              {draft.enabled ? (
                <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">
                        {labels.price}
                        {meta.code === "GLOBAL" ? ` (${draft.currency})` : ""}
                      </span>
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="app-input"
                        lang="en"
                        value={draft.price}
                        onChange={(e) => update(draft.marketId, { price: e.target.value })}
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                      {meta.code === "GLOBAL" && draft.secondaryPrice && draft.secondaryCurrency ? (
                        <span className="text-xs text-[var(--muted)]">
                          {(labels.secondaryOmrHint ?? "OMR (from admin FX): {amount} {currency}")
                            .replace("{amount}", draft.secondaryPrice)
                            .replace("{currency}", draft.secondaryCurrency)}
                        </span>
                      ) : meta.code === "GLOBAL" ? (
                        <span className="text-xs text-[var(--muted)]">
                          {labels.secondaryOmrHint ??
                            "OMR mirror updates when admin sets USD→OMR FX."}
                        </span>
                      ) : null}
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">{labels.quantity}</span>
                      <input
                        required
                        type="number"
                        min="0"
                        step="1"
                        className="app-input"
                        lang="en"
                        value={draft.quantity}
                        onChange={(e) => update(draft.marketId, { quantity: e.target.value })}
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                    </label>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">{labels.stockLocation}</legend>
                    <label className="flex cursor-pointer gap-2 rounded-lg border border-[var(--border)] p-2.5 text-sm has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]">
                      <input
                        type="radio"
                        name={`stock-${draft.marketId}`}
                        checked={draft.stockLocation === "MERCHANT"}
                        onChange={() => update(draft.marketId, { stockLocation: "MERCHANT" })}
                      />
                      <span>
                        <strong className="block">{labels.stockMerchant}</strong>
                        <span className="text-xs text-[var(--muted)]">{labels.stockMerchantHint}</span>
                      </span>
                    </label>
                    <label
                      className={`flex gap-2 rounded-lg border border-[var(--border)] p-2.5 text-sm ${
                        vandsoqAllowed
                          ? "cursor-pointer has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                          : "cursor-not-allowed opacity-55"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`stock-${draft.marketId}`}
                        disabled={!vandsoqAllowed}
                        checked={draft.stockLocation === "VANDSOQ_WAREHOUSE"}
                        onChange={() =>
                          update(draft.marketId, {
                            stockLocation: "VANDSOQ_WAREHOUSE",
                            vandsoqMode: draft.vandsoqMode || "FORSEIZ_STOCK",
                          })
                        }
                      />
                      <span>
                        <strong className="block">{labels.stockVandsoq}</strong>
                        <span className="text-xs text-[var(--muted)]">
                          {vandsoqAllowed ? labels.stockVandsoqHint : labels.stockVandsoqUnavailable}
                        </span>
                      </span>
                    </label>
                  </fieldset>

                  {draft.stockLocation === "VANDSOQ_WAREHOUSE" && vandsoqAllowed ? (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium">{labels.vandsoqMode}</legend>
                      <label className="flex cursor-pointer gap-2 rounded-lg border border-[var(--border)] p-2.5 text-sm has-[:checked]:border-[var(--primary)]">
                        <input
                          type="radio"
                          name={`vandsoq-${draft.marketId}`}
                          checked={draft.vandsoqMode === "FORSEIZ_STOCK"}
                          onChange={() => update(draft.marketId, { vandsoqMode: "FORSEIZ_STOCK" })}
                        />
                        <span>
                          <strong className="block">{labels.vandsoqStockA}</strong>
                          <span className="text-xs text-[var(--muted)]">{labels.vandsoqStockAHint}</span>
                        </span>
                      </label>
                      <label className="flex cursor-pointer gap-2 rounded-lg border border-[var(--border)] p-2.5 text-sm has-[:checked]:border-[var(--primary)]">
                        <input
                          type="radio"
                          name={`vandsoq-${draft.marketId}`}
                          checked={draft.vandsoqMode === "ON_ORDER"}
                          onChange={() => update(draft.marketId, { vandsoqMode: "ON_ORDER" })}
                        />
                        <span>
                          <strong className="block">{labels.vandsoqStockB}</strong>
                          <span className="text-xs text-[var(--muted)]">{labels.vandsoqStockBHint}</span>
                        </span>
                      </label>
                    </fieldset>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function draftsToOffersPayload(drafts: OfferDraft[], activeMarketIds?: string[]) {
  const allow = new Set<string>(launchVisibleOptions(activeMarketIds).map((m) => m.id));
  return drafts
    .filter((d) => d.enabled && allow.has(d.marketId))
    .map((d) => {
      const meta = ALL_MARKET_OPTIONS.find((m) => m.id === d.marketId)!;
      return {
        marketId: d.marketId,
        price: Number.parseFloat(d.price),
        currency: d.currency,
        stockLocation: d.stockLocation,
        warehouseId: d.stockLocation === "VANDSOQ_WAREHOUSE" ? meta.warehouseId : null,
        vandsoqMode: d.stockLocation === "VANDSOQ_WAREHOUSE" ? d.vandsoqMode : null,
        quantity: Number.parseInt(d.quantity || "0", 10) || 0,
      };
    });
}
