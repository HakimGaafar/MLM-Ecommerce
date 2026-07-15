import { z } from "zod";

export const ProductQuestionCreateSchema = z.object({
  questionText: z.string().trim().min(3).max(2000),
});

export type ProductQuestionCreateInput = z.infer<typeof ProductQuestionCreateSchema>;

export const VendorProductQuestionAnswerSchema = z.object({
  answerText: z.string().trim().min(1).max(2000),
  publish: z.boolean().optional().default(true),
});

export type VendorProductQuestionAnswerInput = z.infer<typeof VendorProductQuestionAnswerSchema>;

export const VendorProductQuestionListTab = ["unanswered", "all"] as const;
export type VendorProductQuestionListTab = (typeof VendorProductQuestionListTab)[number];

export const VendorProductQuestionListQuerySchema = z.object({
  tab: z.enum(VendorProductQuestionListTab).optional().default("unanswered"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(5),
});

export type VendorProductQuestionListQuery = z.infer<typeof VendorProductQuestionListQuerySchema>;
