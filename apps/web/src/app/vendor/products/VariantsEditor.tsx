"use client";

import { defaultCurrencyForMarketId } from "@mlm/shared";

export type VariantMarketOfferDraft = {
  marketId: string;
  price: string;
  currency: string;
  quantity: string;
};

export type VariantDraft = {
  clientId: string;
  title: string;
  sku: string;
  offers: VariantMarketOfferDraft[];
};

export type VariantMarketColumn = {
  marketId: string;
  label: string;
  price: string;
  currency: string;
};

type Ui = {
  title: string;
  hint: string;
  add: string;
  remove: string;
  variantTitle: string;
  sku: string;
  quantity: string;
  price: string;
  empty: string;
  enableMarketsFirst: string;
  market: string;
  titlePlaceholder: string;
  skuPlaceholder: string;
};

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function offersForMarkets(
  markets: VariantMarketColumn[],
  existing?: VariantMarketOfferDraft[],
): VariantMarketOfferDraft[] {
  return markets.map((m) => {
    const prev = existing?.find((o) => o.marketId === m.marketId);
    return {
      marketId: m.marketId,
      price: prev?.price || m.price || "",
      currency: prev?.currency || m.currency || defaultCurrencyForMarketId(m.marketId),
      quantity: prev?.quantity ?? "0",
    };
  });
}

export function emptyVariantDraft(markets: VariantMarketColumn[]): VariantDraft {
  return {
    clientId: newClientId(),
    title: "",
    sku: "",
    offers: offersForMarkets(markets),
  };
}

/** Keep each variant’s market columns aligned with currently enabled sell markets. */
export function syncVariantDraftsToMarkets(
  drafts: VariantDraft[],
  markets: VariantMarketColumn[],
): VariantDraft[] {
  return drafts.map((d) => ({
    ...d,
    offers: offersForMarkets(markets, d.offers),
  }));
}

export function draftsToVariantsPayload(drafts: VariantDraft[]) {
  return drafts
    .filter((d) => d.title.trim())
    .map((d, index) => ({
      title: d.title.trim(),
      sku: d.sku.trim() || null,
      sortOrder: index,
      isActive: true,
      offers: d.offers.map((o) => ({
        marketId: o.marketId,
        price: Number(o.price || 0) > 0 ? Number(o.price) : 0.01,
        currency: (o.currency || defaultCurrencyForMarketId(o.marketId)).toUpperCase(),
        quantity: Number.parseInt(o.quantity || "0", 10) || 0,
      })),
    }))
    .filter((d) => d.offers.length > 0);
}

export default function VariantsEditor({
  drafts,
  onChange,
  markets,
  ui,
}: {
  drafts: VariantDraft[];
  onChange: (next: VariantDraft[]) => void;
  markets: VariantMarketColumn[];
  ui: Ui;
}) {
  function updateVariant(clientId: string, patch: Partial<Pick<VariantDraft, "title" | "sku">>) {
    onChange(drafts.map((d) => (d.clientId === clientId ? { ...d, ...patch } : d)));
  }

  function updateOffer(
    clientId: string,
    marketId: string,
    patch: Partial<VariantMarketOfferDraft>,
  ) {
    onChange(
      drafts.map((d) => {
        if (d.clientId !== clientId) return d;
        return {
          ...d,
          offers: d.offers.map((o) => (o.marketId === marketId ? { ...o, ...patch } : o)),
        };
      }),
    );
  }

  if (markets.length === 0) {
    return (
      <div className="space-y-2 rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">{ui.title}</h2>
        <p className="text-sm text-[var(--muted)]">{ui.enableMarketsFirst}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div>
        <h2 className="text-sm font-semibold">{ui.title}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{ui.hint}</p>
      </div>
      {drafts.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <ul className="space-y-4">
          {drafts.map((draft) => (
            <li key={draft.clientId} className="rounded-lg border border-[var(--border)] p-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[10rem] flex-1 text-xs">
                  <span className="text-[var(--muted)]">{ui.variantTitle}</span>
                  <input
                    value={draft.title}
                    onChange={(e) => updateVariant(draft.clientId, { title: e.target.value })}
                    className="app-input mt-1 w-full"
                    placeholder={ui.titlePlaceholder}
                  />
                </label>
                <label className="min-w-[8rem] flex-1 text-xs sm:max-w-[12rem]">
                  <span className="text-[var(--muted)]">{ui.sku}</span>
                  <input
                    value={draft.sku}
                    onChange={(e) => updateVariant(draft.clientId, { sku: e.target.value })}
                    className="app-input mt-1 w-full"
                    placeholder={ui.skuPlaceholder}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-[var(--danger)]"
                  onClick={() => onChange(drafts.filter((d) => d.clientId !== draft.clientId))}
                >
                  {ui.remove}
                </button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-[var(--muted)]">
                      <th className="px-2 py-1 text-start font-medium">{ui.market}</th>
                      <th className="px-2 py-1 text-start font-medium">{ui.price}</th>
                      <th className="px-2 py-1 text-start font-medium">{ui.quantity}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.offers.map((offer) => {
                      const col = markets.find((m) => m.marketId === offer.marketId);
                      return (
                        <tr key={offer.marketId} className="border-t border-[var(--border)]">
                          <td className="px-2 py-2 font-medium">{col?.label ?? offer.marketId}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0.01}
                                step="0.01"
                                value={offer.price}
                                onChange={(e) =>
                                  updateOffer(draft.clientId, offer.marketId, {
                                    price: e.target.value,
                                  })
                                }
                                className="app-input w-24"
                              />
                              <span className="text-[var(--muted)]">{offer.currency}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              value={offer.quantity}
                              onChange={(e) =>
                                updateOffer(draft.clientId, offer.marketId, {
                                  quantity: e.target.value,
                                })
                              }
                              className="app-input w-20"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="btn-secondary"
        onClick={() => onChange([...drafts, emptyVariantDraft(markets)])}
      >
        {ui.add}
      </button>
    </div>
  );
}
