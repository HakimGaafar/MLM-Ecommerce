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

export type MarketOfferOption = {
  id: string;
  code: string;
  warehouseId: string | null;
  defaultCurrency?: string;
};

const SEED_MARKET_OPTIONS: MarketOfferOption[] = [
  { id: MARKET_IDS.SA, code: "SA", warehouseId: VANDSOQ_WAREHOUSE_IDS.SA },
  { id: MARKET_IDS.OM, code: "OM", warehouseId: VANDSOQ_WAREHOUSE_IDS.OM },
  { id: MARKET_IDS.EG, code: "EG", warehouseId: VANDSOQ_WAREHOUSE_IDS.EG },
  { id: MARKET_IDS.GLOBAL, code: "GLOBAL", warehouseId: null },
];

const SEED_WAREHOUSE_BY_CODE: Record<string, string | null> = {
  SA: VANDSOQ_WAREHOUSE_IDS.SA,
  OM: VANDSOQ_WAREHOUSE_IDS.OM,
  EG: VANDSOQ_WAREHOUSE_IDS.EG,
  GLOBAL: null,
};

function launchVisibleOptions(
  activeMarketIds?: string[],
  activeMarkets?: Array<{ id: string; code: string; defaultCurrency?: string }>,
): MarketOfferOption[] {
  if (activeMarkets && activeMarkets.length > 0) {
    return activeMarkets.map((m) => ({
      id: m.id,
      code: m.code,
      warehouseId: SEED_WAREHOUSE_BY_CODE[m.code] ?? null,
      defaultCurrency: m.defaultCurrency,
    }));
  }
  if (activeMarketIds && activeMarketIds.length > 0) {
    const allow = new Set(activeMarketIds);
    const known = SEED_MARKET_OPTIONS.filter((m) => allow.has(m.id));
    const knownIds = new Set(known.map((m) => m.id));
    const extras = activeMarketIds
      .filter((id) => !knownIds.has(id))
      .map((id) => ({ id, code: id, warehouseId: null as string | null }));
    return [...known, ...extras];
  }
  return SEED_MARKET_OPTIONS.filter((m) => {
    const code = m.code as keyof typeof MARKET_LAUNCH_ACTIVE;
    return code in MARKET_LAUNCH_ACTIVE ? MARKET_LAUNCH_ACTIVE[code] : false;
  });
}

export function createDefaultOfferDrafts(
  homeMarketId?: string,
  activeMarketIds?: string[],
  activeMarkets?: Array<{ id: string; code: string; defaultCurrency?: string }>,
): OfferDraft[] {
  return launchVisibleOptions(activeMarketIds, activeMarkets).map((m) => ({
    marketId: m.id,
    enabled: m.id === (homeMarketId ?? MARKET_IDS.SA),
    price: "",
    currency: m.defaultCurrency ?? defaultCurrencyForMarketId(m.id),
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
  secondaryOmrPending?: string;
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
  activeMarkets,
}: {
  drafts: OfferDraft[];
  onChange: (next: OfferDraft[]) => void;
  labels: Labels;
  activeMarketIds?: string[];
  activeMarkets?: Array<{ id: string; code: string; defaultCurrency?: string }>;
}) {
  const options = launchVisibleOptions(activeMarketIds, activeMarkets);

  const nameFor = (code: string) => {
    if (code === "SA") return labels.marketSA;
    if (code === "OM") return labels.marketOM;
    if (code === "EG") return labels.marketEG;
    if (code === "GLOBAL") return labels.marketGLOBAL;
    return code;
  };

  function update(marketId: string, patch: Partial<OfferDraft>) {
    onChange(drafts.map((d) => (d.marketId === marketId ? { ...d, ...patch } : d)));
  }

  const visibleIds = new Set<string>(options.map((m) => m.id));
  const visibleDrafts = drafts.filter((d) => visibleIds.has(d.marketId));

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_4%,var(--surface))] p-4">
      <div>
        <h2 className="text-sm font-semibold">{labels.title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{labels.subtitle}</p>
      </div>
      <div className="space-y-3">
        {visibleDrafts.map((draft) => {
          const meta =
            options.find((m) => m.id === draft.marketId) ??
            ({ id: draft.marketId, code: draft.marketId, warehouseId: null } as MarketOfferOption);
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
                          {labels.secondaryOmrHint
                            ?.replace("{amount}", draft.secondaryPrice)
                            .replace("{currency}", draft.secondaryCurrency)}
                        </span>
                      ) : meta.code === "GLOBAL" ? (
                        <span className="text-xs text-[var(--muted)]">
                          {labels.secondaryOmrPending}
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

export function draftsToOffersPayload(
  drafts: OfferDraft[],
  activeMarketIds?: string[],
  activeMarkets?: Array<{ id: string; code: string; defaultCurrency?: string }>,
) {
  const options = launchVisibleOptions(activeMarketIds, activeMarkets);
  const allow = new Set<string>(options.map((m) => m.id));
  return drafts
    .filter((d) => d.enabled && allow.has(d.marketId))
    .map((d) => {
      const meta =
        options.find((m) => m.id === d.marketId) ??
        ({ id: d.marketId, code: d.marketId, warehouseId: null } as MarketOfferOption);
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
