import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Prisma namespace (e.g. Prisma.sql, transaction types). */
export { Prisma } from "@prisma/client";

/** Enums used across domain services. */
export {
  CouponDiscountType,
  CouponStatus,
  LedgerDirection,
  LedgerStatus,
  OrderReturnReason,
  OrderReturnStatus,
  OrderStatus,
  OrderUnitStatus,
  PaymentMethod,
  PaymentStatus,
  InvoiceDocumentType,
  ProductEditRequestStatus,
  ProductReviewTarget,
  ProductFulfillmentType,
  UserStatus,
  WalletEntryType,
  VendorShippingMode,
  VendorIndirectFulfillment,
  VendorShippingProfileStatus,
  VendorShippingChangeRequestStatus,
  VendorShippingAuditActor,
  OrderFulfillmentEscalationLevel,
  OrderCustomerNoticeType,
  OrderVendorCancellationStatus,
  KycSubjectType,
  KycDocumentType,
  KycDocumentStatus,
} from "@prisma/client";

/** Model types used in service layers. */
export type { Order, OrderItem } from "@prisma/client";

export { isPrismaUniqueViolation, raceSafeUpsert } from "./race-safe-upsert";
