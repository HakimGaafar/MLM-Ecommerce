import { z } from "zod";

export const OrderReturnReasonSchema = z.enum([
  "DONT_WANT",
  "INCOMPLETE",
  "WRONG_ITEM",
  "COUNTERFEIT",
  "DEFECTIVE",
  "USED",
  "DAMAGED_IN_TRANSIT",
]);

export type OrderReturnReason = z.infer<typeof OrderReturnReasonSchema>;

export const OrderReturnCreateSchema = z.object({
  orderId: z.string().trim().min(1),
  unitIds: z.array(z.string().trim().min(1)).min(1),
  reason: OrderReturnReasonSchema,
  details: z.string().trim().min(1).max(4000),
  policyAccepted: z.literal(true),
});

export type OrderReturnCreateInput = z.infer<typeof OrderReturnCreateSchema>;

export const OrderReturnAdminStatusSchema = z
  .object({
    status: z.enum([
      "REQUESTED",
      "RECEIPT_IN_PROGRESS",
      "RECEIPT_COMPLETED",
      "PROCESSING_IN_PROGRESS",
      "PROCESSING_COMPLETED",
      "PROCESSING_REJECTED",
      "REFUND_IN_PROGRESS",
      "REFUND_COMPLETED",
    ]),
    rejectionReason: z.string().trim().max(2000).optional(),
    returnCostFinalFee: z.number().finite().nonnegative().optional(),
    returnCostBearerFinal: z.enum(["CUSTOMER", "VENDOR", "PLATFORM"]).optional(),
    goodsDisposition: z.enum(["HOLD_AT_HUB", "RETURN_TO_VENDOR", "DISPOSE"]).optional(),
    hubInspectionNote: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "PROCESSING_REJECTED") {
      const reason = data.rejectionReason?.trim();
      if (!reason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rejection reason is required when rejecting a return.",
          path: ["rejectionReason"],
        });
      }
    }
  });

export type OrderReturnAdminStatusInput = z.infer<typeof OrderReturnAdminStatusSchema>;

const PAYOUT_FILE_UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Private key from upload, or legacy public `/uploads/...` path, for this vendor. */
export function isVendorPayoutInvoiceStorageKey(fileStorageKey: string, vendorId: string): boolean {
  const key = fileStorageKey.trim();
  if (!key || key.length > 500) return false;
  if (key.includes("://") || key.includes("\\") || key.includes("..")) return false;
  if (!vendorId.trim()) return false;
  const escapedVendor = vendorId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const privateRe = new RegExp(
    `^payout-invoices/${escapedVendor}-${PAYOUT_FILE_UUID}\\.(pdf|jpg|png)$`,
    "i",
  );
  const legacyRe = new RegExp(
    `^/uploads/payout-invoices/${escapedVendor}-${PAYOUT_FILE_UUID}\\.(pdf|jpg|png)$`,
    "i",
  );
  return privateRe.test(key) || legacyRe.test(key);
}

/** Shape-only check — rejects absolute/external URLs. */
export function isSafePayoutInvoiceStorageKeyShape(fileStorageKey: string): boolean {
  const key = fileStorageKey.trim();
  if (!key || key.length > 500) return false;
  if (key.includes("://") || key.includes("\\") || key.includes("..")) return false;
  return (
    /^payout-invoices\/[^/]+\.(pdf|jpg|png)$/i.test(key) ||
    /^\/uploads\/payout-invoices\/[^/]+\.(pdf|jpg|png)$/i.test(key)
  );
}

export const VendorPayoutInvoiceCreateSchema = z.object({
  withdrawalTransactionId: z.string().trim().min(1),
  amountReceived: z.number().finite().positive(),
  currency: z.string().trim().length(3),
  orderNosText: z.string().trim().min(1).max(2000),
  fileStorageKey: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(isSafePayoutInvoiceStorageKeyShape, {
      message: "Invoice file must be an uploaded payout-invoice path.",
    }),
  fileOriginalName: z.string().trim().max(255).optional(),
});

export type VendorPayoutInvoiceCreateInput = z.infer<typeof VendorPayoutInvoiceCreateSchema>;

export const VendorPayoutInvoiceReviewSchema = z.object({
  status: z.enum(["ACCEPTED", "NEEDS_FIX"]),
  reviewNote: z.string().trim().max(2000).optional(),
});

export type VendorPayoutInvoiceReviewInput = z.infer<typeof VendorPayoutInvoiceReviewSchema>;
