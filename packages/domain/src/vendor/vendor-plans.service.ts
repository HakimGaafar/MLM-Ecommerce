import type { PaginatedResult } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import { prisma } from "@mlm/db";

const PLAN_LABELS: Record<string, string> = {
  FREE: "Free",
  STARTER: "Starter",
  GROWTH: "Growth",
  ENTERPRISE: "Enterprise",
};

export type VendorBillDto = {
  id: string;
  type: string;
  description: string;
  amount: string;
  currency: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
};

export type VendorPlansAndBillsDto = {
  planCode: string;
  planLabel: string;
  bills: VendorBillDto[];
  billsPage: number;
  billsPageSize: number;
  billsTotal: number;
  billsHasMore: boolean;
};

async function currentBillingPeriod(): Promise<{ monthStart: Date; monthEnd: Date }> {
  const now = new Date();
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

function billPeriodKey(type: string, periodStart: Date | null): string {
  return `${type}:${periodStart?.toISOString() ?? ""}`;
}

/** Removes duplicate stub rows (same vendor, type, and billing period). */
async function dedupeVendorBills(vendorId: string): Promise<void> {
  const bills = await prisma.vendorBill.findMany({
    where: { vendorId },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, periodStart: true },
  });

  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  for (const bill of bills) {
    const key = billPeriodKey(bill.type, bill.periodStart);
    if (seen.has(key)) duplicateIds.push(bill.id);
    else seen.add(key);
  }

  if (duplicateIds.length > 0) {
    await prisma.vendorBill.deleteMany({ where: { id: { in: duplicateIds } } });
  }
}

async function ensureVendorBillStubs(vendorId: string): Promise<void> {
  await dedupeVendorBills(vendorId);

  const { monthStart, monthEnd } = await currentBillingPeriod();
  const existing = await prisma.vendorBill.findMany({
    where: { vendorId, periodStart: monthStart },
    select: { type: true },
  });
  const existingTypes = new Set(existing.map((row) => row.type));

  const stubs: Array<{
    vendorId: string;
    type: "PLAN_FEE" | "PLATFORM_FEE";
    description: string;
    amount: number;
    currency: string;
    status: "PENDING" | "WAIVED";
    periodStart: Date;
    periodEnd: Date;
  }> = [];

  if (!existingTypes.has("PLAN_FEE")) {
    stubs.push({
      vendorId,
      type: "PLAN_FEE",
      description: "Marketplace plan — Free tier",
      amount: 0,
      currency: "SAR",
      status: "WAIVED",
      periodStart: monthStart,
      periodEnd: monthEnd,
    });
  }

  if (!existingTypes.has("PLATFORM_FEE")) {
    stubs.push({
      vendorId,
      type: "PLATFORM_FEE",
      description: "Platform service fee (stub)",
      amount: 49,
      currency: "SAR",
      status: "PENDING",
      periodStart: monthStart,
      periodEnd: monthEnd,
    });
  }

  if (stubs.length === 0) return;

  await prisma.vendorBill.createMany({ data: stubs });
}

function mapBillRow(b: {
  id: string;
  type: string;
  description: string;
  amount: { toString(): string };
  currency: string;
  status: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
}): VendorBillDto {
  return {
    id: b.id,
    type: b.type,
    description: b.description,
    amount: b.amount.toString(),
    currency: b.currency,
    status: b.status,
    periodStart: b.periodStart?.toISOString() ?? null,
    periodEnd: b.periodEnd?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

export async function listVendorBills(
  vendorId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResult<VendorBillDto>> {
  await ensureVendorBillStubs(vendorId);
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = { vendorId };
  const [rows, total] = await prisma.$transaction([
    prisma.vendorBill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.vendorBill.count({ where }),
  ]);
  return buildPaginatedResult(rows.map(mapBillRow), total, page, pageSize);
}

export async function getVendorPlansAndBills(
  vendorId: string,
  params?: { page?: number; pageSize?: number },
): Promise<VendorPlansAndBillsDto | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { planCode: true },
  });
  if (!vendor) return null;

  const billsResult = await listVendorBills(vendorId, params);

  return {
    planCode: vendor.planCode,
    planLabel: PLAN_LABELS[vendor.planCode] ?? vendor.planCode,
    bills: billsResult.items,
    billsPage: billsResult.page,
    billsPageSize: billsResult.pageSize,
    billsTotal: billsResult.total,
    billsHasMore: billsResult.hasMore,
  };
}
