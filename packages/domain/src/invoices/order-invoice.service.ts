import type { InvoiceDocumentType, OrderItem } from "@mlm/db";
import { Prisma, prisma, raceSafeUpsert } from "@mlm/db";
import { refreshFinalInvoiceAllowed, isOrderInvoiceEligible } from "../orders/order-units.service";
import { getPlatformConfig } from "../platform-config/platform-config.service";
import {
  activeVendorItems,
  buildInvoiceNo,
  calculateCommissionInvoiceTotals,
  calculateVendorSaleInvoiceTotals,
} from "./invoice-calculation";
import { getPlatformInvoiceEntity, isInvoiceGateBypassed } from "./platform-entity";
import { getVendorInvoiceProfile, resolveVendorInvoiceProfile } from "./vendor-invoice-profile.service";

export class OrderInvoiceError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "GATE_CLOSED"
      | "ORDER_NOT_ELIGIBLE"
      | "PROFILE_INCOMPLETE"
      | "NO_LINES"
      | "ALREADY_EXISTS",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "OrderInvoiceError";
  }
}

export type InvoiceLineDto = {
  unitLabel: string | null;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type VendorSaleInvoiceRenderDto = {
  documentType: "VENDOR_SALE";
  invoiceNo: string;
  orderNo: string;
  issuedAt: string;
  currency: string;
  platformLogoUrl: string | null;
  seller: {
    legalName: string;
    vatTrn: string | null;
    logoUrl: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string;
    countryCode: string;
  };
  buyer: {
    name: string;
    email: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postalCode: string | null;
    countryCode: string | null;
    phone: string | null;
  };
  lines: InvoiceLineDto[];
  subtotal: string;
  discountShare: string;
  shippingShare: string;
  vatTotal: string;
  totalAmount: string;
  vatPercent: number | null;
};

export type CommissionInvoiceRenderDto = {
  documentType: "COMMISSION";
  invoiceNo: string;
  orderNo: string;
  issuedAt: string;
  currency: string;
  seller: {
    legalName: string;
    vatTrn: string | null;
    logoUrl: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string;
    countryCode: string;
  };
  buyer: {
    legalName: string;
    vatTrn: string | null;
    logoUrl: string | null;
    addressLine1: string;
    city: string;
    postalCode: string;
    countryCode: string;
  };
  commissionSubtotal: string;
  vatTotal: string;
  totalAmount: string;
  relatedOrderNo: string;
  vatPercent: number | null;
};

export type CustomerOrderInvoiceListItemDto = {
  vendorId: string;
  vendorName: string;
  invoiceNo: string | null;
  available: boolean;
  profileComplete: boolean;
};

const orderSelect = {
  id: true,
  orderNo: true,
  buyerUserId: true,
  subtotal: true,
  shippingFee: true,
  discountTotal: true,
  vatTotal: true,
  marketId: true,
  finalInvoiceAllowed: true,
  status: true,
  paymentStatus: true,
  shippingRecipientName: true,
  shippingPhone: true,
  shippingCountryCode: true,
  shippingCity: true,
  shippingPostalCode: true,
  shippingAddressLine1: true,
  shippingAddressLine2: true,
  buyer: { select: { name: true, email: true } },
  items: {
    orderBy: [{ unitIndex: "asc" as const }, { createdAt: "asc" as const }],
    select: {
      id: true,
      vendorId: true,
      vendorNameSnapshot: true,
      productNameSnapshot: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      unitLabel: true,
      unitStatus: true,
    },
  },
};

async function loadOrder(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
}

export async function assertInvoiceGate(orderId: string): Promise<boolean> {
  if (!(await isOrderInvoiceEligible(orderId))) return false;
  if (isInvoiceGateBypassed()) return true;
  return refreshFinalInvoiceAllowed(orderId);
}

async function requireInvoiceAccess(orderId: string): Promise<void> {
  if (!(await isOrderInvoiceEligible(orderId))) {
    throw new OrderInvoiceError(
      "ORDER_NOT_ELIGIBLE",
      "Invoices are only available for completed, paid, delivered orders.",
    );
  }
  if (!isInvoiceGateBypassed() && !(await refreshFinalInvoiceAllowed(orderId))) {
    throw new OrderInvoiceError("GATE_CLOSED", "Invoice is not available until the return window closes.");
  }
}

export async function listCustomerOrderInvoices(
  buyerUserId: string,
  orderId: string,
): Promise<CustomerOrderInvoiceListItemDto[]> {
  const order = await loadOrder(orderId);
  if (!order || order.buyerUserId !== buyerUserId) return [];

  const gateOpen = await assertInvoiceGate(orderId);
  const vendorIds = [...new Set(order.items.map((i) => i.vendorId))];
  const existing = await prisma.orderInvoice.findMany({
    where: { orderId, documentType: "VENDOR_SALE", vendorId: { in: vendorIds } },
    select: { vendorId: true, invoiceNo: true },
  });
  const byVendor = new Map(existing.map((r) => [r.vendorId, r.invoiceNo]));

  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: {
      id: true,
      storeName: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      postalCode: true,
      countryCode: true,
      logoUrl: true,
      invoiceLegalName: true,
      invoiceVatTrn: true,
      invoiceVatPercent: true,
      invoiceAddressLine1: true,
      invoiceAddressLine2: true,
      invoiceCity: true,
      invoicePostalCode: true,
      invoiceCountryCode: true,
      invoiceLogoUrl: true,
    },
  });
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  return vendorIds.map((vendorId) => {
    const vendor = vendorMap.get(vendorId);
    const name =
      order.items.find((i) => i.vendorId === vendorId)?.vendorNameSnapshot ?? vendor?.storeName ?? "Vendor";
    const profile = vendor ? resolveVendorInvoiceProfile(vendor) : null;
    const hasLines = activeVendorItems(order.items, vendorId).length > 0;
    return {
      vendorId,
      vendorName: name,
      invoiceNo: byVendor.get(vendorId) ?? null,
      available: gateOpen && hasLines && Boolean(profile?.complete),
      profileComplete: Boolean(profile?.complete),
    };
  });
}

function mapLines(
  items: Pick<OrderItem, "productNameSnapshot" | "quantity" | "unitPrice" | "lineTotal" | "unitLabel">[],
): InvoiceLineDto[] {
  return items.map((row) => ({
    unitLabel: row.unitLabel,
    productName: row.productNameSnapshot,
    quantity: row.quantity,
    unitPrice: row.unitPrice.toString(),
    lineTotal: row.lineTotal.toString(),
  }));
}

export async function buildVendorSaleInvoiceRender(
  orderId: string,
  vendorId: string,
): Promise<VendorSaleInvoiceRenderDto> {
  const order = await loadOrder(orderId);
  if (!order) throw new OrderInvoiceError("NOT_FOUND", "Order not found.");

  await requireInvoiceAccess(orderId);

  const profile = await getVendorInvoiceProfile(vendorId);
  if (!profile?.complete) {
    throw new OrderInvoiceError("PROFILE_INCOMPLETE", "Vendor invoice profile is incomplete.");
  }

  const lines = activeVendorItems(order.items, vendorId);
  if (lines.length === 0) throw new OrderInvoiceError("NO_LINES", "No billable items for this vendor.");

  const totals = calculateVendorSaleInvoiceTotals({
    vendorId,
    items: order.items,
    orderSubtotal: Number(order.subtotal),
    orderDiscountTotal: Number(order.discountTotal),
    orderShippingFee: Number(order.shippingFee),
    orderVatTotal: Number(order.vatTotal),
  });
  if (!totals) throw new OrderInvoiceError("NO_LINES", "No billable amount for this vendor.");

  const existing = await prisma.orderInvoice.findUnique({
    where: { orderId_vendorId_documentType: { orderId, vendorId, documentType: "VENDOR_SALE" } },
    select: { invoiceNo: true, generatedAt: true },
  });

  const invoiceNo = existing?.invoiceNo ?? buildInvoiceNo("VS", order.orderNo, vendorId);
  const issuedAt = (existing?.generatedAt ?? new Date()).toISOString();
  const platform = getPlatformInvoiceEntity();

  return {
    documentType: "VENDOR_SALE",
    invoiceNo,
    orderNo: order.orderNo,
    issuedAt,
    currency: "SAR",
    platformLogoUrl: platform.logoUrl,
    seller: {
      legalName: profile.legalName,
      vatTrn: profile.vatTrn,
      logoUrl: profile.logoUrl,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      postalCode: profile.postalCode,
      countryCode: profile.countryCode,
    },
    buyer: {
      name: order.buyer.name,
      email: order.buyer.email,
      addressLine1: order.shippingAddressLine1,
      addressLine2: order.shippingAddressLine2,
      city: order.shippingCity,
      postalCode: order.shippingPostalCode,
      countryCode: order.shippingCountryCode,
      phone: order.shippingPhone,
    },
    lines: mapLines(lines),
    subtotal: totals.subtotal.toFixed(2),
    discountShare: totals.discountShare.toFixed(2),
    shippingShare: totals.shippingShare.toFixed(2),
    vatTotal: totals.vatTotal.toFixed(2),
    totalAmount: totals.totalAmount.toFixed(2),
    vatPercent: profile.vatPercent,
  };
}

export async function buildCommissionInvoiceRender(
  orderId: string,
  vendorId: string,
): Promise<CommissionInvoiceRenderDto> {
  const order = await loadOrder(orderId);
  if (!order) throw new OrderInvoiceError("NOT_FOUND", "Order not found.");

  await requireInvoiceAccess(orderId);

  const vendorProfile = await getVendorInvoiceProfile(vendorId);
  if (!vendorProfile?.complete) {
    throw new OrderInvoiceError("PROFILE_INCOMPLETE", "Vendor invoice profile is incomplete.");
  }

  const platformConfig = await getPlatformConfig(order.marketId);
  const totals = calculateCommissionInvoiceTotals({
    vendorId,
    items: order.items,
    orderSubtotal: Number(order.subtotal),
    orderDiscountTotal: Number(order.discountTotal),
    platformRate: platformConfig.platformRate,
  });
  if (!totals) throw new OrderInvoiceError("NO_LINES", "No commission for this vendor on this order.");

  const platform = getPlatformInvoiceEntity();
  const existing = await prisma.orderInvoice.findUnique({
    where: { orderId_vendorId_documentType: { orderId, vendorId, documentType: "COMMISSION" } },
    select: { invoiceNo: true, generatedAt: true },
  });

  const invoiceNo = existing?.invoiceNo ?? buildInvoiceNo("FC", order.orderNo, vendorId);
  const issuedAt = (existing?.generatedAt ?? new Date()).toISOString();

  return {
    documentType: "COMMISSION",
    invoiceNo,
    orderNo: order.orderNo,
    issuedAt,
    currency: "SAR",
    seller: {
      legalName: platform.legalName,
      vatTrn: platform.vatTrn,
      logoUrl: platform.logoUrl,
      addressLine1: platform.addressLine1,
      addressLine2: platform.addressLine2 ?? null,
      city: platform.city,
      postalCode: platform.postalCode,
      countryCode: platform.countryCode,
    },
    buyer: {
      legalName: vendorProfile.legalName,
      vatTrn: vendorProfile.vatTrn,
      logoUrl: vendorProfile.logoUrl,
      addressLine1: vendorProfile.addressLine1,
      city: vendorProfile.city,
      postalCode: vendorProfile.postalCode,
      countryCode: vendorProfile.countryCode,
    },
    commissionSubtotal: totals.commissionSubtotal.toFixed(2),
    vatTotal: totals.vatTotal.toFixed(2),
    totalAmount: totals.totalAmount.toFixed(2),
    relatedOrderNo: order.orderNo,
    vatPercent: Math.round(platformConfig.vatRate * 10000) / 100,
  };
}

export async function getStoredInvoice(
  orderId: string,
  vendorId: string,
  documentType: InvoiceDocumentType,
) {
  return prisma.orderInvoice.findUnique({
    where: { orderId_vendorId_documentType: { orderId, vendorId, documentType } },
  });
}

export async function saveGeneratedInvoice(params: {
  orderId: string;
  vendorId: string;
  documentType: InvoiceDocumentType;
  invoiceNo: string;
  storageKey: string;
  fileUrl: string | null;
  subtotal: string;
  vatTotal: string;
  totalAmount: string;
}) {
  const invoiceWhere = {
    orderId_vendorId_documentType: {
      orderId: params.orderId,
      vendorId: params.vendorId,
      documentType: params.documentType,
    },
  };

  return raceSafeUpsert({
    upsert: () =>
      prisma.orderInvoice.upsert({
        where: invoiceWhere,
        create: {
          orderId: params.orderId,
          vendorId: params.vendorId,
          documentType: params.documentType,
          invoiceNo: params.invoiceNo,
          storageKey: params.storageKey,
          fileUrl: params.fileUrl,
          subtotal: new Prisma.Decimal(params.subtotal),
          vatTotal: new Prisma.Decimal(params.vatTotal),
          totalAmount: new Prisma.Decimal(params.totalAmount),
        },
        update: {
          storageKey: params.storageKey,
          fileUrl: params.fileUrl,
          subtotal: new Prisma.Decimal(params.subtotal),
          vatTotal: new Prisma.Decimal(params.vatTotal),
          totalAmount: new Prisma.Decimal(params.totalAmount),
        },
      }),
    findUnique: () => prisma.orderInvoice.findUnique({ where: invoiceWhere }),
  });
}

export async function logInvoiceDownload(invoiceId: string, userId: string): Promise<void> {
  await prisma.invoiceDownloadLog.create({
    data: { invoiceId, userId },
  });
}

export async function assertCustomerCanAccessVendorSaleInvoice(
  buyerUserId: string,
  orderId: string,
  vendorId: string,
): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, buyerUserId },
    select: { id: true },
  });
  if (!order) throw new OrderInvoiceError("FORBIDDEN", "Order not found for this account.");
  const hasVendorLines = await prisma.orderItem.count({
    where: { orderId, vendorId, unitStatus: { not: "RETURNED" } },
  });
  if (hasVendorLines === 0) throw new OrderInvoiceError("NOT_FOUND", "No items for this vendor.");
}

export async function assertVendorOwnsOrderLine(vendorId: string, orderId: string): Promise<void> {
  const count = await prisma.orderItem.count({ where: { orderId, vendorId } });
  if (count === 0) throw new OrderInvoiceError("FORBIDDEN", "Order not found for this vendor.");
}
