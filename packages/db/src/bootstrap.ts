import type { PrismaClient } from "@prisma/client";
import {
  FOURCES_WAREHOUSE_IDS,
  FOURCES_WAREHOUSE_MARKET_CODES,
  MARKET_DEFINITIONS,
  MARKET_IDS,
} from "@mlm/shared";

async function resolveClient(client?: PrismaClient): Promise<PrismaClient> {
  if (client) return client;
  const { prisma } = await import("./index");
  return prisma;
}

/** Required for registration, seller onboarding, and role assignment. */
export const REQUIRED_ROLE_CODES = [
  "ADMIN",
  "SUPER_ADMIN",
  "VENDOR",
  "CUSTOMER",
  "AFFILIATE",
] as const;

const STABLE_ROLE_IDS: Record<(typeof REQUIRED_ROLE_CODES)[number], string> = {
  ADMIN: "role_admin",
  SUPER_ADMIN: "role_super_admin",
  VENDOR: "role_vendor",
  CUSTOMER: "role_customer",
  AFFILIATE: "role_affiliate",
};

function minWithdrawalFromEnv(): number {
  const raw = process.env.MIN_WITHDRAWAL_AMOUNT_SAR;
  if (raw === undefined || raw.trim() === "") return 250;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 250;
  return Math.round(parsed * 100) / 100;
}

async function seedRoles(client: PrismaClient) {
  for (const code of REQUIRED_ROLE_CODES) {
    await client.role.upsert({
      where: { code },
      update: {},
      create: { id: STABLE_ROLE_IDS[code], code },
    });
  }
}

async function seedMarkets(client: PrismaClient) {
  for (const def of MARKET_DEFINITIONS) {
    const id = MARKET_IDS[def.code];
    await client.market.upsert({
      where: { code: def.code },
      update: {
        subdomain: def.subdomain,
        nameEn: def.nameEn,
        nameAr: def.nameAr,
        defaultCurrency: def.defaultCurrency,
        geoCountryCodes: [...def.geoCountryCodes],
        isActive: true,
        sortOrder: def.sortOrder,
      },
      create: {
        id,
        code: def.code,
        subdomain: def.subdomain,
        nameEn: def.nameEn,
        nameAr: def.nameAr,
        defaultCurrency: def.defaultCurrency,
        geoCountryCodes: [...def.geoCountryCodes],
        isActive: true,
        sortOrder: def.sortOrder,
      },
    });
  }
}

async function seedFourcesWarehouses(client: PrismaClient) {
  const warehouses = FOURCES_WAREHOUSE_MARKET_CODES.map((code) => ({
    id: FOURCES_WAREHOUSE_IDS[code],
    marketId: MARKET_IDS[code],
    countryCode: code,
    name: `FOURCES Warehouse — ${code === "SA" ? "Saudi Arabia" : code === "OM" ? "Oman" : "Egypt"}`,
  }));

  for (const wh of warehouses) {
    await client.fourcesWarehouse.upsert({
      where: { id: wh.id },
      update: {
        marketId: wh.marketId,
        countryCode: wh.countryCode,
        name: wh.name,
        isActive: true,
      },
      create: {
        id: wh.id,
        marketId: wh.marketId,
        countryCode: wh.countryCode,
        name: wh.name,
        isActive: true,
      },
    });
  }
}

async function seedPlatformConfig(client: PrismaClient) {
  const minWithdrawal = minWithdrawalFromEnv();
  const base = {
    cashbackRate: 0.05,
    affiliatePoolRate: 0.1,
    affiliateLevel1Rate: 0.05,
    affiliateLevel2Rate: 0.02,
    affiliateLevel3Rate: 0.02,
    affiliateLevel4Rate: 0.01,
    vendorRate: 0.7,
    platformRate: 0.3,
    vatRate: 0.15,
    minWithdrawalAmount: minWithdrawal,
    returnWindowDays: 15,
  };

  const configs = [
    { id: "config_market_sa", marketId: MARKET_IDS.SA },
    { id: "config_market_om", marketId: MARKET_IDS.OM },
    { id: "config_market_eg", marketId: MARKET_IDS.EG },
    { id: "config_market_global", marketId: MARKET_IDS.GLOBAL },
  ] as const;

  for (const row of configs) {
    await client.platformConfig.upsert({
      where: { marketId: row.marketId },
      create: { id: row.id, marketId: row.marketId, ...base },
      update: { minWithdrawalAmount: minWithdrawal },
    });
  }
}

/** Idempotent upserts for reference data required before the app can register users or checkout. */
export async function bootstrapRequiredReferenceData(client?: PrismaClient): Promise<void> {
  const db = await resolveClient(client);
  await seedRoles(db);
  await seedMarkets(db);
  await seedFourcesWarehouses(db);
  await seedPlatformConfig(db);
}

export async function isRequiredReferenceDataPresent(client?: PrismaClient): Promise<boolean> {
  const db = await resolveClient(client);
  const roles = await db.role.findMany({
    where: { code: { in: [...REQUIRED_ROLE_CODES] } },
    select: { code: true },
  });
  return roles.length === REQUIRED_ROLE_CODES.length;
}

/** Runs bootstrap only when roles (or other mandatory rows) are missing. Safe on every deploy. */
export async function ensureRequiredReferenceData(client?: PrismaClient): Promise<void> {
  const db = await resolveClient(client);
  if (await isRequiredReferenceDataPresent(db)) return;
  await bootstrapRequiredReferenceData(db);
  console.log("[bootstrap] Required reference data ensured (roles, markets, warehouses, platform config).");
}
