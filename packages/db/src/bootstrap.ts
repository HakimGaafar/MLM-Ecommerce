import type { PrismaClient } from "@prisma/client";
import {
  VANDSOQ_WAREHOUSE_IDS,
  VANDSOQ_WAREHOUSE_MARKET_CODES,
  MARKET_DEFINITIONS,
  MARKET_IDS,
  MARKET_PAYMENT_CURRENCIES,
  MARKET_LAUNCH_ACTIVE,
  LEGAL_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_TITLES,
  DEFAULT_LEGAL_POLICY_VERSION,
  DEFAULT_REFUND_FEE_PAYERS,
  REFUND_FEE_CAUSES,
  type MarketCode,
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
    const paymentCurrencies = [...MARKET_PAYMENT_CURRENCIES[def.code]];
    const isActive = MARKET_LAUNCH_ACTIVE[def.code];
    await client.market.upsert({
      where: { code: def.code },
      update: {
        subdomain: def.subdomain,
        nameEn: def.nameEn,
        nameAr: def.nameAr,
        defaultCurrency: def.defaultCurrency,
        paymentCurrencies,
        geoCountryCodes: [...def.geoCountryCodes],
        // Do not force isActive on update — admin may open/close markets.
        sortOrder: def.sortOrder,
      },
      create: {
        id,
        code: def.code,
        subdomain: def.subdomain,
        nameEn: def.nameEn,
        nameAr: def.nameAr,
        defaultCurrency: def.defaultCurrency,
        paymentCurrencies,
        geoCountryCodes: [...def.geoCountryCodes],
        isActive,
        sortOrder: def.sortOrder,
      },
    });
  }
}

async function seedVandsoqWarehouses(client: PrismaClient) {
  const warehouses = VANDSOQ_WAREHOUSE_MARKET_CODES.map((code) => ({
    id: VANDSOQ_WAREHOUSE_IDS[code],
    marketId: MARKET_IDS[code],
    countryCode: code,
    name: `VANDSOQ Warehouse — ${code === "SA" ? "Saudi Arabia" : code === "OM" ? "Oman" : "Egypt"}`,
  }));

  for (const wh of warehouses) {
    await client.vandsoqWarehouse.upsert({
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
  const baseByMarket: Record<MarketCode, { vatRate: number; codEnabled: boolean }> = {
    SA: { vatRate: 0.15, codEnabled: true },
    OM: { vatRate: 0.05, codEnabled: true },
    EG: { vatRate: 0, codEnabled: true },
    GLOBAL: { vatRate: 0.05, codEnabled: false },
  };

  const shared = {
    cashbackRate: 0.05,
    affiliatePoolRate: 0.1,
    affiliateLevel1Rate: 0.05,
    affiliateLevel2Rate: 0.02,
    affiliateLevel3Rate: 0.02,
    affiliateLevel4Rate: 0.01,
    vendorRate: 0.95,
    platformRate: 0.05,
    platformRateCross: 0.1,
    vendorRateCross: 0.9,
    minWithdrawalAmount: minWithdrawal,
    returnWindowDays: 15,
  };

  const configs = [
    { id: "config_market_sa", marketId: MARKET_IDS.SA, code: "SA" as const },
    { id: "config_market_om", marketId: MARKET_IDS.OM, code: "OM" as const },
    { id: "config_market_eg", marketId: MARKET_IDS.EG, code: "EG" as const },
    { id: "config_market_global", marketId: MARKET_IDS.GLOBAL, code: "GLOBAL" as const },
  ];

  for (const row of configs) {
    const marketRules = baseByMarket[row.code];
    await client.platformConfig.upsert({
      where: { marketId: row.marketId },
      create: {
        id: row.id,
        marketId: row.marketId,
        ...shared,
        vatRate: marketRules.vatRate,
        codEnabled: marketRules.codEnabled,
      },
      update: {
        minWithdrawalAmount: minWithdrawal,
        vatRate: marketRules.vatRate,
        codEnabled: marketRules.codEnabled,
      },
    });
  }
}

type IssuerSeed = {
  id: string;
  marketId: string;
  code: string;
  legalNameEn: string;
  legalNameAr: string;
  commercialRegistration: string | null;
  unifiedNumber: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string | null;
  countryCode: string;
  phone: string;
  email: string;
  consumerProtectionAuthorityEn: string;
  consumerProtectionAuthorityAr: string;
  vatRegistered: boolean;
  vatTrn: string | null;
  vatPercent: number;
  currency: string;
};

async function seedMarketInvoiceIssuers(client: PrismaClient) {
  const issuers: IssuerSeed[] = [
    {
      id: "issuer_om",
      marketId: MARKET_IDS.OM,
      code: "OM-VISION",
      legalNameEn: "Vision and Development Company SPC",
      legalNameAr: "شركة الرؤية والتطوير ش.ش.و",
      commercialRegistration: "1537990",
      unifiedNumber: null,
      addressLine1: "Al-Bawarih – Al-Suwaiq – North Al Batinah",
      addressLine2: null,
      city: "Al-Suwaiq",
      postalCode: null,
      countryCode: "OM",
      phone: "+968 77523743",
      email: "infoom@vandsoq.com",
      consumerProtectionAuthorityEn:
        "The competent consumer-protection authority in the Sultanate of Oman",
      consumerProtectionAuthorityAr: "جهة حماية المستهلك المختصة في سلطنة عُمان",
      vatRegistered: true,
      vatTrn: null,
      vatPercent: 5,
      currency: "OMR",
    },
    {
      id: "issuer_sa",
      marketId: MARKET_IDS.SA,
      code: "SA-NABD",
      legalNameEn: "NABD AL-AAMAL Ltd COMPANY",
      legalNameAr: "شركة نبض الأعمال المحدودة",
      commercialRegistration: "1010846637",
      unifiedNumber: "7032197050",
      addressLine1:
        "Riyadh, Al-Arid, King Abdulaziz bin Abdulrahman Saud Branch Rd, Building 6249",
      addressLine2: "Secondary 2858, Postal 13342 (RRRA6249)",
      city: "Riyadh",
      postalCode: "13342",
      countryCode: "SA",
      phone: "+966 552222166",
      email: "infoksa@vandsoq.com",
      consumerProtectionAuthorityEn:
        "The competent consumer-protection authority in the Kingdom of Saudi Arabia",
      consumerProtectionAuthorityAr: "جهة حماية المستهلك المختصة في المملكة العربية السعودية",
      vatRegistered: true,
      vatTrn: "311492184600003",
      vatPercent: 15,
      currency: "SAR",
    },
    {
      id: "issuer_eg",
      marketId: MARKET_IDS.EG,
      code: "EG-4CS",
      legalNameEn: "4CS COMPANY",
      legalNameAr: "شركة فور سي اس",
      commercialRegistration: "198620",
      unifiedNumber: null,
      addressLine1: "Floor 14 - 19A Al-Obour Buildings - Salah Salem - Heliopolis",
      addressLine2: "Cairo, Egypt",
      city: "Cairo",
      postalCode: null,
      countryCode: "EG",
      phone: "+20 111 5535494",
      email: "infoegy@vandsoq.com",
      consumerProtectionAuthorityEn:
        "The competent consumer-protection authority in the Arab Republic of Egypt",
      consumerProtectionAuthorityAr: "جهة حماية المستهلك المختصة في جمهورية مصر العربية",
      vatRegistered: false,
      vatTrn: null,
      vatPercent: 14,
      currency: "EGP",
    },
    {
      id: "issuer_global",
      marketId: MARKET_IDS.GLOBAL,
      code: "INTL-OM",
      legalNameEn: "Vision and Development Company SPC",
      legalNameAr: "شركة الرؤية والتطوير ش.ش.و",
      commercialRegistration: "1537990",
      unifiedNumber: null,
      addressLine1: "Al-Bawarih – Al-Suwaiq – North Al Batinah",
      addressLine2: null,
      city: "Al-Suwaiq",
      postalCode: null,
      countryCode: "OM",
      phone: "+968 77523743",
      email: "infoint@vandsoq.com",
      consumerProtectionAuthorityEn:
        "The competent consumer-protection authority in the Sultanate of Oman",
      consumerProtectionAuthorityAr: "جهة حماية المستهلك المختصة في سلطنة عُمان",
      vatRegistered: true,
      vatTrn: null,
      vatPercent: 5,
      currency: "OMR",
    },
  ];

  for (const row of issuers) {
    await client.marketInvoiceIssuer.upsert({
      where: { marketId: row.marketId },
      create: row,
      update: {
        code: row.code,
        legalNameEn: row.legalNameEn,
        legalNameAr: row.legalNameAr,
        commercialRegistration: row.commercialRegistration,
        unifiedNumber: row.unifiedNumber,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        city: row.city,
        postalCode: row.postalCode,
        countryCode: row.countryCode,
        phone: row.phone,
        email: row.email,
        consumerProtectionAuthorityEn: row.consumerProtectionAuthorityEn,
        consumerProtectionAuthorityAr: row.consumerProtectionAuthorityAr,
        vatPercent: row.vatPercent,
        currency: row.currency,
        vatRegistered: row.vatRegistered,
        vatTrn: row.vatTrn,
      },
    });
  }
}

async function seedLegalPolicyVersions(client: PrismaClient) {
  const now = new Date();
  for (const def of MARKET_DEFINITIONS) {
    const marketId = MARKET_IDS[def.code];
    for (const documentType of LEGAL_DOCUMENT_TYPES) {
      const titles = LEGAL_DOCUMENT_TITLES[documentType];
      const id = `lpv_${def.code.toLowerCase()}_${documentType.toLowerCase()}_v1`;
      await client.legalPolicyVersion.upsert({
        where: {
          marketId_documentType_version: {
            marketId,
            documentType,
            version: DEFAULT_LEGAL_POLICY_VERSION,
          },
        },
        create: {
          id,
          marketId,
          documentType,
          version: DEFAULT_LEGAL_POLICY_VERSION,
          titleEn: titles.en,
          titleAr: titles.ar,
          bodyEn: null,
          bodyAr: null,
          publishedAt: null,
          isCurrent: true,
        },
        update: {
          titleEn: titles.en,
          titleAr: titles.ar,
          isCurrent: true,
          updatedAt: now,
        },
      });
    }
  }
}

async function seedMarketInvoicingRules(client: PrismaClient) {
  const codes = MARKET_DEFINITIONS.map((d) => d.code);
  const now = new Date();
  for (const seller of codes) {
    for (const buyer of codes) {
      const sellerMarketId = MARKET_IDS[seller];
      const buyerMarketId = MARKET_IDS[buyer];
      const sameMarket = seller === buyer;
      const invoicingParty = sameMarket ? "MERCHANT" : "PLATFORM";
      const commissionRate = sameMarket ? 0.05 : 0.1;
      const id = `invrule_${seller.toLowerCase()}_${buyer.toLowerCase()}`;
      await client.marketInvoicingRule.upsert({
        where: {
          sellerMarketId_buyerMarketId: {
            sellerMarketId,
            buyerMarketId,
          },
        },
        create: {
          id,
          sellerMarketId,
          buyerMarketId,
          invoicingParty,
          commissionRate,
        },
        update: {
          invoicingParty,
          commissionRate,
          updatedAt: now,
        },
      });
    }
  }
}

async function seedRefundFeeRules(client: PrismaClient) {
  const now = new Date();
  for (const def of MARKET_DEFINITIONS) {
    const marketId = MARKET_IDS[def.code];
    for (const cause of REFUND_FEE_CAUSES) {
      const payer = DEFAULT_REFUND_FEE_PAYERS[cause];
      const id = `rfr_${def.code.toLowerCase()}_${cause.toLowerCase()}`;
      await client.refundFeeRule.upsert({
        where: {
          marketId_cause: { marketId, cause },
        },
        create: {
          id,
          marketId,
          cause,
          payer,
        },
        update: {
          payer,
          updatedAt: now,
        },
      });
    }
  }
}

/** Idempotent upserts for reference data required before the app can register users or checkout. */
export async function bootstrapRequiredReferenceData(client?: PrismaClient): Promise<void> {
  const db = await resolveClient(client);
  await seedRoles(db);
  await seedMarkets(db);
  await seedVandsoqWarehouses(db);
  await seedPlatformConfig(db);
  await seedMarketInvoiceIssuers(db);
  await seedLegalPolicyVersions(db);
  await seedMarketInvoicingRules(db);
  await seedRefundFeeRules(db);
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
  if (!(await isRequiredReferenceDataPresent(db))) {
    await bootstrapRequiredReferenceData(db);
    console.log(
      "[bootstrap] Required reference data ensured (roles, markets, warehouses, platform config).",
    );
    return;
  }
  // Keep Phase 1 legal foundations idempotent on existing databases after migrate.
  await ensureLegalFoundationsData(db);
}

/** Idempotent Phase 1 legal foundations seed — safe to run after migrate. */
export async function ensureLegalFoundationsData(client?: PrismaClient): Promise<void> {
  const db = await resolveClient(client);
  await seedMarkets(db);
  await seedMarketInvoiceIssuers(db);
  await seedLegalPolicyVersions(db);
  await seedMarketInvoicingRules(db);
  await seedRefundFeeRules(db);
  // Egypt starts closed via migration + create seed (MARKET_LAUNCH_ACTIVE).
  // Do not force isActive here — admin may open a market later.
}
