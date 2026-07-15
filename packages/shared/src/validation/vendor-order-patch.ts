import { z } from "zod";
import { ProductFulfillmentTypeSchema } from "../product-fulfillment";

const orderStatusSchema = z.enum(["NEW", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"]);
const paymentStatusSchema = z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]);

export const VendorOrderPatchSchema = z
  .object({
    status: orderStatusSchema.optional(),
    paymentStatus: paymentStatusSchema.optional(),
    lineItemId: z.string().min(1).optional(),
    lineStatus: orderStatusSchema.optional(),
    fulfillmentType: ProductFulfillmentTypeSchema.optional(),
    fulfillmentStatus: orderStatusSchema.optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.paymentStatus !== undefined ||
      data.lineStatus !== undefined ||
      data.fulfillmentStatus !== undefined,
    {
      message: "Provide status, paymentStatus, lineStatus, and/or fulfillmentStatus",
    },
  )
  .refine((data) => (data.lineStatus === undefined ? true : Boolean(data.lineItemId)), {
    message: "lineItemId is required when lineStatus is provided",
  })
  .refine((data) => (data.lineItemId === undefined ? true : data.lineStatus !== undefined), {
    message: "lineStatus is required when lineItemId is provided",
  })
  .refine((data) => data.lineStatus !== "COMPLETED", {
    message: "Vendors cannot mark line items as completed",
  })
  .refine((data) => (data.fulfillmentStatus === undefined ? true : Boolean(data.fulfillmentType)), {
    message: "fulfillmentType is required when fulfillmentStatus is provided",
  })
  .refine((data) => (data.fulfillmentType === undefined ? true : data.fulfillmentStatus !== undefined), {
    message: "fulfillmentStatus is required when fulfillmentType is provided",
  })
  .refine((data) => data.fulfillmentStatus !== "COMPLETED", {
    message: "Vendors cannot mark fulfillment groups as completed",
  });

export type VendorOrderPatchInput = z.infer<typeof VendorOrderPatchSchema>;
