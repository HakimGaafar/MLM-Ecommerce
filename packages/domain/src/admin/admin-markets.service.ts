import { prisma } from "@mlm/db";
import type { AdminMarketUpdateInput } from "@mlm/shared";
import {
  DEFAULT_MARKET_CODE,
  getMarketDefinition,
  isMarketCode,
  isSeedMarketCode,
  type MarketCode,
} from "@mlm/shared";

export type AdminMarketDto = {
  id: string;
  code: string;
  subdomain: string;
  nameEn: string;
  nameAr: string;
  defaultCurrency: string;
  paymentCurrencies: string[];
  geoCountryCodes: string[];
  isActive: boolean;
  lifecycleStatus: "DRAFT" | "READY" | "LIVE" | "SUSPENDED";
  papersComplete: boolean;
  sortOrder: number;
  canDisable: boolean;
};

function mapLifecycle(value: string | undefined | null): AdminMarketDto["lifecycleStatus"] {
  if (value === "DRAFT" || value === "READY" || value === "LIVE" || value === "SUSPENDED") {
    return value;
  }
  return "DRAFT";
}

function mapRow(row: {
  id: string;
  code: string;
  subdomain: string;
  nameEn: string;
  nameAr: string;
  defaultCurrency: string;
  paymentCurrencies?: string[];
  geoCountryCodes: string[];
  isActive: boolean;
  lifecycleStatus?: string;
  papersComplete?: boolean;
  sortOrder: number;
}): AdminMarketDto {
  return {
    id: row.id,
    code: row.code,
    subdomain: row.subdomain,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    defaultCurrency: row.defaultCurrency,
    paymentCurrencies: row.paymentCurrencies ?? [row.defaultCurrency],
    geoCountryCodes: row.geoCountryCodes,
    isActive: row.isActive,
    lifecycleStatus: mapLifecycle(
      row.lifecycleStatus ?? (row.isActive ? "LIVE" : "DRAFT"),
    ),
    papersComplete: Boolean(row.papersComplete),
    sortOrder: row.sortOrder,
    canDisable: row.code !== DEFAULT_MARKET_CODE,
  };
}

export async function listAdminMarkets(): Promise<AdminMarketDto[]> {
  try {
    const rows = await prisma.market.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        code: true,
        subdomain: true,
        nameEn: true,
        nameAr: true,
        defaultCurrency: true,
        paymentCurrencies: true,
        geoCountryCodes: true,
        isActive: true,
        lifecycleStatus: true,
        papersComplete: true,
        sortOrder: true,
      },
    });
    if (rows.length > 0) {
      return rows.map(mapRow);
    }
  } catch {
    // Table may not exist before migrate — fall back to static definitions.
  }

  const { listActiveMarketDefinitions, MARKET_PAYMENT_CURRENCIES, MARKET_LAUNCH_ACTIVE } =
    await import("@mlm/shared");
  return listActiveMarketDefinitions().map((def) => ({
    id: `market_${def.code.toLowerCase()}`,
    code: def.code,
    subdomain: def.subdomain,
    nameEn: def.nameEn,
    nameAr: def.nameAr,
    defaultCurrency: def.defaultCurrency,
    paymentCurrencies: [...MARKET_PAYMENT_CURRENCIES[def.code]],
    geoCountryCodes: [...def.geoCountryCodes],
    isActive: MARKET_LAUNCH_ACTIVE[def.code],
    lifecycleStatus: MARKET_LAUNCH_ACTIVE[def.code] ? ("LIVE" as const) : ("DRAFT" as const),
    papersComplete: false,
    sortOrder: def.sortOrder,
    canDisable: def.code !== DEFAULT_MARKET_CODE,
  }));
}

export async function updateAdminMarket(params: {
  marketCode: MarketCode | string;
  input: AdminMarketUpdateInput;
}): Promise<AdminMarketDto> {
  const market = await prisma.market.findUnique({
    where: { code: params.marketCode },
    select: { id: true, code: true },
  });
  if (!market) {
    throw new Error("MARKET_NOT_FOUND");
  }

  if (params.input.isActive === false) {
    await setMarketActive({ marketCode: params.marketCode, isActive: false });
  } else if (params.input.isActive === true) {
    await setMarketActive({ marketCode: params.marketCode, isActive: true });
  }

  if (params.input.paymentCurrencies || params.input.defaultCurrency) {
    const current = await prisma.market.findUnique({
      where: { id: market.id },
      select: { paymentCurrencies: true, defaultCurrency: true },
    });
    const paymentCurrencies = params.input.paymentCurrencies ?? current?.paymentCurrencies ?? [];
    const defaultCurrency = params.input.defaultCurrency ?? current?.defaultCurrency ?? "";
    if (paymentCurrencies.length > 0 && defaultCurrency && !paymentCurrencies.includes(defaultCurrency)) {
      throw new Error("DEFAULT_CURRENCY_NOT_IN_PAYMENT_CURRENCIES");
    }
  }

  const updated = await prisma.market.update({
    where: { id: market.id },
    data: {
      ...(params.input.nameEn !== undefined ? { nameEn: params.input.nameEn } : {}),
      ...(params.input.nameAr !== undefined ? { nameAr: params.input.nameAr } : {}),
      ...(params.input.sortOrder !== undefined ? { sortOrder: params.input.sortOrder } : {}),
      ...(params.input.geoCountryCodes !== undefined
        ? { geoCountryCodes: params.input.geoCountryCodes }
        : {}),
      ...(params.input.paymentCurrencies !== undefined
        ? { paymentCurrencies: params.input.paymentCurrencies }
        : {}),
      ...(params.input.defaultCurrency !== undefined
        ? { defaultCurrency: params.input.defaultCurrency }
        : {}),
    },
    select: {
      id: true,
      code: true,
      subdomain: true,
      nameEn: true,
      nameAr: true,
      defaultCurrency: true,
      paymentCurrencies: true,
      geoCountryCodes: true,
      isActive: true,
      lifecycleStatus: true,
      papersComplete: true,
      sortOrder: true,
    },
  });

  return mapRow(updated);
}

export async function setMarketActive(params: {
  marketCode: MarketCode | string;
  isActive: boolean;
}): Promise<AdminMarketDto & { goLive?: { migratedVendors: number; flaggedUsers: number } }> {
  if (params.marketCode === DEFAULT_MARKET_CODE && !params.isActive) {
    throw new Error("CANNOT_DISABLE_DEFAULT_MARKET");
  }

  const market = await prisma.market.findUnique({
    where: { code: params.marketCode },
    select: { id: true, code: true, isActive: true },
  });
  if (!market) {
    throw new Error("MARKET_NOT_FOUND");
  }

  if (!params.isActive) {
    const activeCount = await prisma.market.count({ where: { isActive: true } });
    if (market.isActive && activeCount <= 1) {
      throw new Error("LAST_ACTIVE_MARKET");
    }

    const updated = await prisma.market.update({
      where: { id: market.id },
      data: { isActive: false, lifecycleStatus: "SUSPENDED" },
      select: {
        id: true,
        code: true,
        subdomain: true,
        nameEn: true,
        nameAr: true,
        defaultCurrency: true,
        paymentCurrencies: true,
        geoCountryCodes: true,
        isActive: true,
        lifecycleStatus: true,
        papersComplete: true,
        sortOrder: true,
      },
    });
    return mapRow(updated);
  }

  // Opening: same gates as wizard Publish (pack readiness + live DNS verify).
  const { getMarketWizardState, AdminMarketWizardError } = await import(
    "./admin-market-wizard.service"
  );
  const { verifyMarketHostDns } = await import("../markets/host-dns-verify.service");
  const { openMarketGoLive, MarketGoLiveError } = await import("../markets/market-go-live.service");

  try {
    const state = await getMarketWizardState(params.marketCode);
    // Same pack gate as Mark READY (DNS verified live below, not via stale flag alone).
    if (!state.canMarkReady) {
      const packBlocker = state.blockers.find((b) => b !== "DNS_NOT_VERIFIED");
      throw new Error(packBlocker ?? "NOT_READY");
    }
    if (!state.routing.hostBound || !state.routing.geoBound) {
      throw new Error("ROUTING_NOT_BOUND");
    }

    const dns = await verifyMarketHostDns({ marketCode: params.marketCode, persist: true });
    if (!dns.ok) {
      throw new Error("DNS_NOT_VERIFIED");
    }

    const goLive = await openMarketGoLive(params.marketCode);
    await prisma.market.update({
      where: { id: market.id },
      data: { lifecycleStatus: "LIVE", isActive: true },
    });
    const updated = await prisma.market.findUniqueOrThrow({
      where: { id: market.id },
      select: {
        id: true,
        code: true,
        subdomain: true,
        nameEn: true,
        nameAr: true,
        defaultCurrency: true,
        paymentCurrencies: true,
        geoCountryCodes: true,
        isActive: true,
        lifecycleStatus: true,
        papersComplete: true,
        sortOrder: true,
      },
    });
    return {
      ...mapRow(updated),
      goLive: {
        migratedVendors: goLive.migratedVendors,
        flaggedUsers: goLive.flaggedUsers,
      },
    };
  } catch (error) {
    if (error instanceof MarketGoLiveError) {
      throw new Error(error.code);
    }
    if (error instanceof AdminMarketWizardError) {
      throw new Error(error.code);
    }
    throw error;
  }
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
  return isSeedMarketCode(code) ? getMarketDefinition(code) !== undefined : false;
}
