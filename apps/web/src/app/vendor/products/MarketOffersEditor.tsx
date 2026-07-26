"use client";

import { FOURCES_WAREHOUSE_IDS, MARKET_IDS, defaultCurrencyForMarketId } from "@mlm/shared";

export type OfferDraft = {
  marketId: string;
  enabled: boolean;
  price: string;
  currency: string;
  stockLocation: "MERCHANT" | "FOURCES_WAREHOUSE";
  quantity: string;
};

const MARKET_OPTIONS = [
  { id: MARKET_IDS.SA, code: "SA" as const, warehouseId: FOURCES_WAREHOUSE_IDS.SA },
  { id: MARKET_IDS.OM, code: "OM" as const, warehouseId: FOURCES_WAREHOUSE_IDS.OM },
  { id: MARKET_IDS.EG, code: "EG" as const, warehouseId: FOURCES_WAREHOUSE_IDS.EG },
  { id: MARKET_IDS.GLOBAL, code: "GLOBAL" as const, warehouseId: null },
];

export function createDefaultOfferDrafts(homeMarketId?: string): OfferDraft[] {
  return MARKET_OPTIONS.map((m) => ({
    marketId: m.id,
    enabled: m.id === (homeMarketId ?? MARKET_IDS.SA),
    price: "",
    currency: defaultCurrencyForMarketId(m.id),
    stockLocation: "MERCHANT",
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
  quantity: string;
  stockLocation: string;
  stockMerchant: string;
  stockMerchantHint: string;
  stockFources: string;
  stockFourcesHint: string;
  stockFourcesUnavailable: string;
};

export default function MarketOffersEditor({
  drafts,
  onChange,
  labels,
}: {
  drafts: OfferDraft[];
  onChange: (next: OfferDraft[]) => void;
  labels: Labels;
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

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_4%,var(--surface))] p-4">
      <div>
        <h2 className="text-sm font-semibold">{labels.title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{labels.subtitle}</p>
      </div>
      <div className="space-y-3">
        {drafts.map((draft) => {
          const meta = MARKET_OPTIONS.find((m) => m.id === draft.marketId)!;
          const fourcesAllowed = Boolean(meta.warehouseId);
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
                <span className="ms-auto rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[var(--muted)] dark:bg-white/10">
                  {draft.currency}
                </span>
              </label>

              {draft.enabled ? (
                <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">{labels.price}</span>
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="app-input"
                        value={draft.price}
                        onChange={(e) => update(draft.marketId, { price: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">{labels.quantity}</span>
                      <input
                        required
                        type="number"
                        min="0"
                        step="1"
                        className="app-input"
                        value={draft.quantity}
                        onChange={(e) => update(draft.marketId, { quantity: e.target.value })}
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
                        fourcesAllowed
                          ? "cursor-pointer has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                          : "cursor-not-allowed opacity-55"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`stock-${draft.marketId}`}
                        disabled={!fourcesAllowed}
                        checked={draft.stockLocation === "FOURCES_WAREHOUSE"}
                        onChange={() =>
                          update(draft.marketId, { stockLocation: "FOURCES_WAREHOUSE" })
                        }
                      />
                      <span>
                        <strong className="block">{labels.stockFources}</strong>
                        <span className="text-xs text-[var(--muted)]">
                          {fourcesAllowed ? labels.stockFourcesHint : labels.stockFourcesUnavailable}
                        </span>
                      </span>
                    </label>
                  </fieldset>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function draftsToOffersPayload(drafts: OfferDraft[]) {
  return drafts
    .filter((d) => d.enabled)
    .map((d) => {
      const meta = MARKET_OPTIONS.find((m) => m.id === d.marketId)!;
      return {
        marketId: d.marketId,
        price: Number.parseFloat(d.price),
        currency: d.currency,
        stockLocation: d.stockLocation,
        warehouseId:
          d.stockLocation === "FOURCES_WAREHOUSE" ? meta.warehouseId : null,
        quantity: Number.parseInt(d.quantity || "0", 10) || 0,
      };
    });
}
