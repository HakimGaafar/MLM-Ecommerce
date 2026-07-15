import { z } from "zod";
import { ProductFulfillmentTypeSchema } from "../product-fulfillment";

export const OrderFulfillmentEscalationLevelSchema = z.enum(["REMINDER", "WARNING", "ESCALATION"]);

export const OrderEscalationCreateSchema = z.object({
  vendorId: z.string().min(1),
  fulfillmentType: ProductFulfillmentTypeSchema.optional(),
  level: OrderFulfillmentEscalationLevelSchema,
  message: z.string().max(2000).optional(),
});

export const OrderAdminNoteCreateSchema = z.object({
  body: z.string().min(1).max(10000),
});

export const OrderCustomerNoticeCreateSchema = z.object({
  type: z.enum(["DELAY", "GENERAL"]).optional(),
  body: z.string().min(1).max(5000),
});

export const OrderVendorCancelSchema = z.object({
  vendorId: z.string().min(1),
  reason: z.string().min(10).max(5000),
});

export type OrderEscalationCreateInput = z.infer<typeof OrderEscalationCreateSchema>;
export type OrderAdminNoteCreateInput = z.infer<typeof OrderAdminNoteCreateSchema>;
export type OrderCustomerNoticeCreateInput = z.infer<typeof OrderCustomerNoticeCreateSchema>;
export type OrderVendorCancelInput = z.infer<typeof OrderVendorCancelSchema>;
