import { z } from "zod";

export const OrderReturnReasonSchema = z.enum([
  "DONT_WANT",
  "INCOMPLETE",
  "WRONG_ITEM",
  "COUNTERFEIT",
  "DEFECTIVE",
  "USED",
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
