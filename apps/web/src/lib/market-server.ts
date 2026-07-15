import { cache } from "react";
import { prisma } from "@mlm/db";
import {
  DEFAULT_MARKET_CODE,
  getMarketDefinition,
  isMarketCode,
  type MarketCode,
} from "@mlm/shared";
import { cookies, headers } from "next/headers";
import {
  ACTIVE_MARKET_COOKIE,
  definitionToSnapshot,
  getDefaultMarketSnapshot,
  MARKET_REQUEST_HEADER,
  resolveMarketCodeFromHost,
  type MarketSnapshot,
} from "@/lib/market-context";

function snapshotFromDbRow(row: {
  id: string;
  code: string;
  subdomain: string;
  defaultCurrency: string;
  nameEn: string;
  nameAr: string;
}): MarketSnapshot | null {
  if (!isMarketCode(row.code)) return null;
  return {
    id: row.id,
    code: row.code,
    subdomain: row.subdomain,
    defaultCurrency: row.defaultCurrency,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
  };
}

async function loadMarketByCode(code: MarketCode): Promise<MarketSnapshot> {
  try {
    const row = await prisma.market.findFirst({
      where: { code },
      select: {
        id: true,
        code: true,
        subdomain: true,
        defaultCurrency: true,
        nameEn: true,
        nameAr: true,
        isActive: true,
      },
    });
    if (row) {
      if (!row.isActive) {
        return loadMarketByCode(DEFAULT_MARKET_CODE);
      }
      const snap = snapshotFromDbRow(row);
      if (snap) return snap;
    }
  } catch {
    // Table may not exist before migrate — fall back to static definitions.
  }
  return definitionToSnapshot(getMarketDefinition(code));
}

export async function isMarketCodeActive(code: MarketCode): Promise<boolean> {
  try {
    const row = await prisma.market.findFirst({
      where: { code },
      select: { isActive: true },
    });
    if (row) return row.isActive;
  } catch {
    // fall through
  }
  return true;
}

export async function isHostMarketInactive(host: string, rootDomain?: string): Promise<MarketCode | null> {
  const fromHost = resolveMarketCodeFromHost(host, rootDomain);
  if (!fromHost) return null;
  const active = await isMarketCodeActive(fromHost);
  return active ? null : fromHost;
}

export const getActiveMarket = cache(async function getActiveMarket(): Promise<MarketSnapshot> {
  const hdrs = await headers();
  const fromProxy = hdrs.get(MARKET_REQUEST_HEADER);
  if (fromProxy && isMarketCode(fromProxy)) {
    return loadMarketByCode(fromProxy);
  }

  const host = hdrs.get("host") ?? "";
  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim();
  const fromHost = resolveMarketCodeFromHost(host, rootDomain);
  if (fromHost) {
    return loadMarketByCode(fromHost);
  }

  const cookieStore = await cookies();
  const cookieCode = cookieStore.get(ACTIVE_MARKET_COOKIE)?.value;
  if (cookieCode && isMarketCode(cookieCode)) {
    return loadMarketByCode(cookieCode);
  }

  return loadMarketByCode(DEFAULT_MARKET_CODE);
});

export async function listMarketsForPicker(): Promise<MarketSnapshot[]> {
  try {
    const rows = await prisma.market.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        code: true,
        subdomain: true,
        defaultCurrency: true,
        nameEn: true,
        nameAr: true,
      },
    });
    if (rows.length > 0) {
      return rows
        .map((row) => snapshotFromDbRow(row))
        .filter((row): row is MarketSnapshot => row !== null);
    }
  } catch {
    // fall through
  }
  const { listActiveMarketDefinitions } = await import("@mlm/shared");
  return listActiveMarketDefinitions().map((def) => definitionToSnapshot(def));
}

export function getGeoCountryFromHeaders(headerStore: Headers): string | null {
  const geoHeader = process.env.GEO_IP_HEADER?.trim() || "cf-ipcountry";
  const raw =
    headerStore.get(geoHeader) ??
    headerStore.get("x-vercel-ip-country") ??
    readDevGeoCountryOverride();
  const cc = raw?.trim().toUpperCase();
  return cc && cc !== "XX" && cc !== "T1" ? cc : null;
}

function readDevGeoCountryOverride(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const cc = process.env.DEV_GEO_COUNTRY?.trim().toUpperCase();
  return cc && cc.length === 2 ? cc : null;
}

export async function getSuggestedMarketCode(): Promise<MarketCode> {
  const { resolveMarketFromGeoCountry } = await import("@mlm/shared");
  const hdrs = await headers();
  return resolveMarketFromGeoCountry(getGeoCountryFromHeaders(hdrs));
}

export { getDefaultMarketSnapshot };
