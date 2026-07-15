import {
  DEFAULT_MARKET_CODE,
  MARKET_DEFINITIONS,
  type MarketCode,
  type MarketDefinition,
} from "@mlm/shared";

export const ACTIVE_MARKET_COOKIE = process.env.MARKET_COOKIE_NAME?.trim() || "mlm_active_market";

export const MARKET_REQUEST_HEADER = "x-mlm-market";

export const GEO_IP_HEADER = process.env.GEO_IP_HEADER?.trim() || "cf-ipcountry";

export type MarketSnapshot = {
  id: string;
  code: MarketCode;
  subdomain: string;
  defaultCurrency: string;
  nameEn: string;
  nameAr: string;
};

export function definitionToSnapshot(def: MarketDefinition, id?: string): MarketSnapshot {
  return {
    id: id ?? `market_${def.code.toLowerCase()}`,
    code: def.code,
    subdomain: def.subdomain,
    defaultCurrency: def.defaultCurrency,
    nameEn: def.nameEn,
    nameAr: def.nameAr,
  };
}

export function parseHostSubdomain(host: string, rootDomain?: string): string | null {
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return null;
  }

  const root = rootDomain?.trim().toLowerCase();
  if (root && (hostname === root || hostname === `www.${root}`)) {
    return null;
  }

  const parts = hostname.split(".");
  if (parts.length < 2) return null;

  const sub = parts[0];
  if (!sub || sub === "www") return null;
  return sub;
}

export function resolveMarketCodeFromHost(host: string, rootDomain?: string): MarketCode | null {
  const sub = parseHostSubdomain(host, rootDomain);
  if (!sub) return null;
  const def = MARKET_DEFINITIONS.find((m) => m.subdomain === sub);
  return def?.code ?? null;
}

export function isApexOrWwwHost(host: string, rootDomain?: string): boolean {
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }
  const root = rootDomain?.trim().toLowerCase();
  if (!root) return hostname.split(".").length <= 2;
  return hostname === root || hostname === `www.${root}`;
}

export function buildMarketOrigin(params: {
  market: Pick<MarketSnapshot, "subdomain">;
  protocol: string;
  rootDomain?: string;
  fallbackHost: string;
}): string {
  const { market, protocol, rootDomain, fallbackHost } = params;
  const root = rootDomain?.trim();
  if (!root || fallbackHost.startsWith("localhost") || fallbackHost.startsWith("127.0.0.1")) {
    return `${protocol}//${fallbackHost}`;
  }
  return `${protocol}//${market.subdomain}.${root}`;
}

export function getDefaultMarketSnapshot(): MarketSnapshot {
  const def = MARKET_DEFINITIONS.find((m) => m.code === DEFAULT_MARKET_CODE)!;
  return definitionToSnapshot(def);
}
