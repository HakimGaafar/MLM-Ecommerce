import { cache } from "react";
import { prisma } from "@mlm/db";
import {
  resolveActiveMarketCodeByGeoCountry,
  resolveMarketCodeBySubdomain,
} from "@mlm/domain";
import {
  DEFAULT_MARKET_CODE,
  getMarketDefinition,
  isMarketCode,
  isMarketCodeFormat,
  isSeedMarketCode,
  type MarketCode,
} from "@mlm/shared";
import { cookies, headers } from "next/headers";
import {
  ACTIVE_MARKET_COOKIE,
  definitionToSnapshot,
  getDefaultMarketSnapshot,
  MARKET_REQUEST_HEADER,
  parseHostSubdomainOrNull,
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
  if (!isMarketCodeFormat(row.code)) return null;
  return {
    id: row.id,
    code: row.code as MarketCode,
    subdomain: row.subdomain,
    defaultCurrency: row.defaultCurrency,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
  };
}

export async function getMarketSnapshotByCode(code: string): Promise<MarketSnapshot> {
  return loadMarketByCode(code);
}

async function loadMarketByCode(code: string): Promise<MarketSnapshot> {
  const normalized = code.trim().toUpperCase();
  try {
    const row = await prisma.market.findFirst({
      where: { code: normalized },
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
  if (isSeedMarketCode(normalized)) {
    return definitionToSnapshot(getMarketDefinition(normalized));
  }
  return loadMarketByCode(DEFAULT_MARKET_CODE);
}

export async function isMarketCodeActive(code: string): Promise<boolean> {
  try {
    const row = await prisma.market.findFirst({
      where: { code: code.trim().toUpperCase() },
      select: { isActive: true },
    });
    if (row) return row.isActive;
  } catch {
    // fall through
  }
  return isMarketCode(code);
}

/** DB-first host → market code. */
export async function resolveMarketCodeFromHostAsync(
  host: string,
  rootDomain?: string,
): Promise<string | null> {
  const sub = parseHostSubdomainOrNull(host, rootDomain);
  if (!sub) return null;
  const fromDb = await resolveMarketCodeBySubdomain(sub);
  if (fromDb) return fromDb;
  return resolveMarketCodeFromHost(host, rootDomain);
}

export async function isHostMarketInactive(
  host: string,
  rootDomain?: string,
): Promise<string | null> {
  const fromHost = await resolveMarketCodeFromHostAsync(host, rootDomain);
  if (!fromHost) return null;
  const active = await isMarketCodeActive(fromHost);
  return active ? null : fromHost;
}

export const getActiveMarket = cache(async function getActiveMarket(): Promise<MarketSnapshot> {
  const hdrs = await headers();
  const fromProxy = hdrs.get(MARKET_REQUEST_HEADER);
  if (fromProxy && isMarketCodeFormat(fromProxy)) {
    return loadMarketByCode(fromProxy);
  }

  const host = hdrs.get("host") ?? "";
  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim();
  const fromHost = await resolveMarketCodeFromHostAsync(host, rootDomain);
  if (fromHost) {
    return loadMarketByCode(fromHost);
  }

  const cookieStore = await cookies();
  const cookieCode = cookieStore.get(ACTIVE_MARKET_COOKIE)?.value;
  if (cookieCode && isMarketCodeFormat(cookieCode)) {
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
  const { listLaunchActiveMarketDefinitions } = await import("@mlm/shared");
  return listLaunchActiveMarketDefinitions().map((def) => definitionToSnapshot(def));
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
  const hdrs = await headers();
  const natural = await resolveActiveMarketCodeByGeoCountry(getGeoCountryFromHeaders(hdrs));
  if (await isMarketCodeActive(natural)) return natural as MarketCode;
  return "GLOBAL";
}

export { getDefaultMarketSnapshot };
