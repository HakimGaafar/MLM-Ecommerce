import { z } from "zod";

const cuidLike = z.string().trim().min(10).max(64);

export const WalletWithdrawSchema = z.object({
  amount: z.coerce.number().positive().max(10_000_000),
  kycSubject: z.enum(["CUSTOMER", "AFFILIATE"]).optional().default("CUSTOMER"),
});

export type WalletWithdrawInput = z.infer<typeof WalletWithdrawSchema>;

export const AdminWithdrawalPatchSchema = z
  .object({
    action: z.enum(["approve", "decline", "mark_paid"]),
    bankReference: z.string().trim().max(120).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "mark_paid" && !data.bankReference?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "bankReference is required when marking paid",
        path: ["bankReference"],
      });
    }
  });

export type AdminWithdrawalPatchInput = z.infer<typeof AdminWithdrawalPatchSchema>;

export const AdminSettlementReleaseSchema = z.object({
  transactionIds: z.array(cuidLike).min(1).max(200),
});

export type AdminSettlementReleaseInput = z.infer<typeof AdminSettlementReleaseSchema>;

export const AdminSettlementReleaseForUserSchema = z.object({
  userId: cuidLike,
  entryTypes: z
    .array(z.enum(["AFFILIATE_COMMISSION", "VENDOR_EARNING"]))
    .max(2)
    .optional(),
});

export type AdminSettlementReleaseForUserInput = z.infer<
  typeof AdminSettlementReleaseForUserSchema
>;

export const AdminKycReviewSchema = z
  .object({
    action: z.enum(["accept", "reject"]),
    rejectionReason: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "reject" && !data.rejectionReason?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "rejectionReason is required when rejecting",
        path: ["rejectionReason"],
      });
    }
  });

export type AdminKycReviewInput = z.infer<typeof AdminKycReviewSchema>;

export const AdminKycRequestUpdateSchema = z.object({
  documentIds: z.array(cuidLike).min(1).max(50),
  message: z.string().trim().max(2000).optional(),
});

export type AdminKycRequestUpdateInput = z.infer<typeof AdminKycRequestUpdateSchema>;

export const AdminAffiliateRankPatchSchema = z.object({
  rankTitle: z.enum(["Member", "Bronze", "Silver", "Gold", "Platinum"]),
});

export type AdminAffiliateRankPatchInput = z.infer<typeof AdminAffiliateRankPatchSchema>;
