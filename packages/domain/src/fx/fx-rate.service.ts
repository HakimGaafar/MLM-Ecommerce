import { Prisma, prisma } from "@mlm/db";

export class FxRateError extends Error {
  constructor(
    public readonly code: "INVALID_PAIR" | "INVALID_RATE" | "NOT_FOUND",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "FxRateError";
  }
}

export type FxRateDto = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  source: string;
  effectiveAt: string;
  createdAt: string;
};

function normalizeCurrency(code: string): string {
  return code.trim().toUpperCase();
}

function toDto(row: {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: Prisma.Decimal;
  source: string;
  effectiveAt: Date;
  createdAt: Date;
}): FxRateDto {
  return {
    id: row.id,
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate.toFixed(8).replace(/\.?0+$/, "") || "0",
    source: row.source,
    effectiveAt: row.effectiveAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Latest rate for a pair as of `at` (default now). Returns 1 for same-currency. */
export async function getLatestFxRate(
  fromCurrency: string,
  toCurrency: string,
  at: Date = new Date(),
): Promise<number | null> {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from.length !== 3 || to.length !== 3) return null;
  if (from === to) return 1;

  const row = await prisma.fxRate.findFirst({
    where: {
      fromCurrency: from,
      toCurrency: to,
      effectiveAt: { lte: at },
    },
    orderBy: { effectiveAt: "desc" },
  });
  return row ? Number(row.rate) : null;
}

export async function convertAmount(params: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  at?: Date;
}): Promise<{ rate: number; converted: number } | null> {
  const rate = await getLatestFxRate(params.fromCurrency, params.toCurrency, params.at);
  if (rate == null) return null;
  return { rate, converted: Math.round(params.amount * rate * 100) / 100 };
}

export async function listFxRates(params?: {
  fromCurrency?: string;
  toCurrency?: string;
  limit?: number;
}): Promise<FxRateDto[]> {
  const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
  const rows = await prisma.fxRate.findMany({
    where: {
      ...(params?.fromCurrency
        ? { fromCurrency: normalizeCurrency(params.fromCurrency) }
        : {}),
      ...(params?.toCurrency ? { toCurrency: normalizeCurrency(params.toCurrency) } : {}),
    },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toDto);
}

export async function upsertManualFxRate(params: {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveAt?: Date;
  createdByUserId?: string | null;
}): Promise<FxRateDto> {
  const from = normalizeCurrency(params.fromCurrency);
  const to = normalizeCurrency(params.toCurrency);
  if (from.length !== 3 || to.length !== 3 || from === to) {
    throw new FxRateError("INVALID_PAIR", "Provide two different 3-letter currency codes.");
  }
  if (!Number.isFinite(params.rate) || params.rate <= 0) {
    throw new FxRateError("INVALID_RATE", "Rate must be a positive number.");
  }

  const effectiveAt = params.effectiveAt ?? new Date();
  const rate = new Prisma.Decimal(params.rate.toFixed(8));

  const row = await prisma.fxRate.upsert({
    where: {
      fromCurrency_toCurrency_effectiveAt: {
        fromCurrency: from,
        toCurrency: to,
        effectiveAt,
      },
    },
    create: {
      fromCurrency: from,
      toCurrency: to,
      rate,
      source: "MANUAL",
      effectiveAt,
      createdByUserId: params.createdByUserId ?? null,
    },
    update: {
      rate,
      source: "MANUAL",
      createdByUserId: params.createdByUserId ?? null,
    },
  });

  return toDto(row);
}
