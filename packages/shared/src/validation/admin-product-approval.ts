import { z } from "zod";

export const AdminProductApprovalSchema = z
  .object({
    action: z.enum(["approve", "reject", "request_changes"]),
    rejectionReason: z.string().trim().max(2000).optional(),
    changeRequestNote: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === "reject" && !v.rejectionReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejectionReason"],
        message: "Rejection reason is required.",
      });
    }
    if (v.action === "request_changes" && !v.changeRequestNote?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["changeRequestNote"],
        message: "Change request note is required.",
      });
    }
  });

export type AdminProductApprovalInput = z.infer<typeof AdminProductApprovalSchema>;
