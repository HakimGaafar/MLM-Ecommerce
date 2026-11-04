import { Prisma, prisma } from "@mlm/db";
import {
  isSafePayoutInvoiceStorageKeyShape,
  isVendorPayoutInvoiceStorageKey,
  type VendorPayoutInvoiceCreateInput,
  type VendorPayoutInvoiceReviewInput,
} from "@mlm/shared";

export class VendorPayoutInvoiceError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "NOT_PAID"
      | "ALREADY_EXISTS"
      | "INVALID_STATUS"
      | "INVALID_FILE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorPayoutInvoiceError";
  }
}

export type VendorPayoutInvoiceDto = {
  id: string;
  marketId: string;
  vendorId: string;
  withdrawalTransactionId: string;
  amountReceived: string;
  currency: string;
  orderNosText: string;
  fileStorageKey: string;
  fileOriginalName: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  withdrawalAmount: string;
  paidAt: string | null;
};

function mapDto(row: {
  id: string;
  marketId: string;
  vendorId: string;
  withdrawalTransactionId: string;
  amountReceived: Prisma.Decimal;
  currency: string;
  orderNosText: string;
  fileStorageKey: string;
  fileOriginalName: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  withdrawalTransaction: { amount: Prisma.Decimal; metaJson: unknown };
}): VendorPayoutInvoiceDto {
  const meta =
    row.withdrawalTransaction.metaJson &&
    typeof row.withdrawalTransaction.metaJson === "object" &&
    !Array.isArray(row.withdrawalTransaction.metaJson)
      ? (row.withdrawalTransaction.metaJson as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    marketId: row.marketId,
    vendorId: row.vendorId,
    withdrawalTransactionId: row.withdrawalTransactionId,
    amountReceived: row.amountReceived.toFixed(2),
    currency: row.currency,
    orderNosText: row.orderNosText,
    // Never expose external/absolute URLs to admin/vendor UI links.
    fileStorageKey: isSafePayoutInvoiceStorageKeyShape(row.fileStorageKey)
      ? row.fileStorageKey
      : "",
    fileOriginalName: row.fileOriginalName,
    status: row.status,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    withdrawalAmount: row.withdrawalTransaction.amount.toFixed(2),
    paidAt: typeof meta.paidAt === "string" ? meta.paidAt : null,
  };
}

async function resolveVendorForOwner(ownerUserId: string, marketId: string) {
  return prisma.vendor.findFirst({
    where: { ownerUserId, OR: [{ marketId }, { primaryMarketId: marketId }] },
    select: { id: true, ownerUserId: true, marketId: true, primaryMarketId: true },
  });
}

/** Paid withdrawals for this vendor owner that still need a purchase invoice (warn-only). */
export async function listVendorPaidWithdrawalsNeedingInvoice(params: {
  ownerUserId: string;
  marketId: string;
}): Promise<
  Array<{
    withdrawalTransactionId: string;
    amount: string;
    currency: string;
    paidAt: string | null;
    hasInvoice: boolean;
    invoiceStatus: string | null;
  }>
> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId_marketId: { userId: params.ownerUserId, marketId: params.marketId } },
    select: { id: true, currency: true },
  });
  if (!wallet) return [];

  const rows = await prisma.walletTransaction.findMany({
    where: {
      walletId: wallet.id,
      entryType: "WITHDRAWAL",
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { vendorPayoutInvoice: { select: { status: true } } },
  });

  return rows
    .map((r) => {
      const meta =
        r.metaJson && typeof r.metaJson === "object" && !Array.isArray(r.metaJson)
          ? (r.metaJson as Record<string, unknown>)
          : {};
      const paidAt = typeof meta.paidAt === "string" ? meta.paidAt : null;
      if (!paidAt) return null;
      return {
        withdrawalTransactionId: r.id,
        amount: r.amount.toFixed(2),
        currency: wallet.currency,
        paidAt,
        hasInvoice: Boolean(r.vendorPayoutInvoice),
        invoiceStatus: r.vendorPayoutInvoice?.status ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);
}

export async function createVendorPayoutInvoice(params: {
  ownerUserId: string;
  marketId: string;
  input: VendorPayoutInvoiceCreateInput;
}): Promise<VendorPayoutInvoiceDto> {
  const vendor = await resolveVendorForOwner(params.ownerUserId, params.marketId);
  if (!vendor) {
    throw new VendorPayoutInvoiceError("FORBIDDEN", "Vendor not found for this account.");
  }

  const withdrawal = await prisma.walletTransaction.findFirst({
    where: {
      id: params.input.withdrawalTransactionId,
      userId: params.ownerUserId,
      entryType: "WITHDRAWAL",
      status: "APPROVED",
      wallet: { marketId: params.marketId },
    },
    include: { vendorPayoutInvoice: true },
  });
  if (!withdrawal) {
    throw new VendorPayoutInvoiceError("NOT_FOUND", "Withdrawal not found.");
  }
  const meta =
    withdrawal.metaJson && typeof withdrawal.metaJson === "object" && !Array.isArray(withdrawal.metaJson)
      ? (withdrawal.metaJson as Record<string, unknown>)
      : {};
  if (typeof meta.paidAt !== "string") {
    throw new VendorPayoutInvoiceError(
      "NOT_PAID",
      "Upload the purchase invoice only after the bank payout is marked paid.",
    );
  }
  const fileStorageKey = params.input.fileStorageKey.trim();
  if (!isVendorPayoutInvoiceStorageKey(fileStorageKey, vendor.id)) {
    throw new VendorPayoutInvoiceError(
      "INVALID_FILE",
      "Invoice file must be uploaded via the payout-invoice upload endpoint for this vendor.",
    );
  }

  const existing = withdrawal.vendorPayoutInvoice;
  if (existing && existing.status !== "NEEDS_FIX") {
    throw new VendorPayoutInvoiceError("ALREADY_EXISTS", "An invoice already exists for this payout.");
  }

  if (existing?.status === "NEEDS_FIX") {
    const updated = await prisma.vendorPayoutInvoice.update({
      where: { id: existing.id },
      data: {
        amountReceived: new Prisma.Decimal(params.input.amountReceived),
        currency: params.input.currency.toUpperCase(),
        orderNosText: params.input.orderNosText.trim(),
        fileStorageKey,
        fileOriginalName: params.input.fileOriginalName?.trim() || null,
        status: "PENDING_REVIEW",
        reviewNote: null,
        reviewedAt: null,
        reviewedByUserId: null,
      },
      include: { withdrawalTransaction: { select: { amount: true, metaJson: true } } },
    });
    return mapDto(updated);
  }

  const created = await prisma.vendorPayoutInvoice.create({
    data: {
      marketId: params.marketId,
      vendorId: vendor.id,
      uploadedByUserId: params.ownerUserId,
      withdrawalTransactionId: withdrawal.id,
      amountReceived: new Prisma.Decimal(params.input.amountReceived),
      currency: params.input.currency.toUpperCase(),
      orderNosText: params.input.orderNosText.trim(),
      fileStorageKey,
      fileOriginalName: params.input.fileOriginalName?.trim() || null,
      status: "PENDING_REVIEW",
    },
    include: { withdrawalTransaction: { select: { amount: true, metaJson: true } } },
  });

  return mapDto(created);
}

export async function listAdminVendorPayoutInvoices(params: {
  marketId: string;
  status?: "PENDING_REVIEW" | "ACCEPTED" | "NEEDS_FIX";
  page?: number;
  pageSize?: number;
}): Promise<{ items: VendorPayoutInvoiceDto[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const where = {
    marketId: params.marketId,
    ...(params.status ? { status: params.status } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.vendorPayoutInvoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { withdrawalTransaction: { select: { amount: true, metaJson: true } } },
    }),
    prisma.vendorPayoutInvoice.count({ where }),
  ]);
  return {
    items: rows.map(mapDto),
    total,
    page,
    pageSize,
  };
}

export async function reviewVendorPayoutInvoice(params: {
  invoiceId: string;
  marketId: string;
  reviewerUserId: string;
  input: VendorPayoutInvoiceReviewInput;
}): Promise<VendorPayoutInvoiceDto> {
  const row = await prisma.vendorPayoutInvoice.findFirst({
    where: { id: params.invoiceId, marketId: params.marketId },
  });
  if (!row) throw new VendorPayoutInvoiceError("NOT_FOUND", "Invoice not found.");
  if (row.status !== "PENDING_REVIEW" && row.status !== "NEEDS_FIX") {
    throw new VendorPayoutInvoiceError("INVALID_STATUS", "This invoice cannot be reviewed now.");
  }

  const updated = await prisma.vendorPayoutInvoice.update({
    where: { id: row.id },
    data: {
      status: params.input.status,
      reviewNote: params.input.reviewNote?.trim() || null,
      reviewedByUserId: params.reviewerUserId,
      reviewedAt: new Date(),
    },
    include: { withdrawalTransaction: { select: { amount: true, metaJson: true } } },
  });
  return mapDto(updated);
}
