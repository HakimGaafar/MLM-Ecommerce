import { z } from "zod";
import { ProductFulfillmentTypeSchema } from "../product-fulfillment";

const orderStatusSchema = z.enum(["NEW", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"]);
const paymentStatusSchema = z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]);

export const AdminOrderPatchSchema = z
  .object({
    status: orderStatusSchema.optional(),
    paymentStatus: paymentStatusSchema.optional(),
    vendorId: z.string().min(1).optional(),
    fulfillmentType: ProductFulfillmentTypeSchema.optional(),
    fulfillmentStatus: orderStatusSchema.optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.paymentStatus !== undefined ||
      data.fulfillmentStatus !== undefined,
    {
      message: "Provide status, paymentStatus, and/or fulfillmentStatus",
    },
  )
  .refine((data) => (data.fulfillmentStatus === undefined ? true : Boolean(data.vendorId)), {
    message: "vendorId is required when fulfillmentStatus is provided",
  })
  .refine((data) => (data.fulfillmentStatus === undefined ? true : Boolean(data.fulfillmentType)), {
    message: "fulfillmentType is required when fulfillmentStatus is provided",
  })
  .refine(
    (data) =>
      data.fulfillmentType === undefined && data.vendorId === undefined
        ? true
        : data.fulfillmentStatus !== undefined,
    {
      message: "fulfillmentStatus is required when vendorId or fulfillmentType is provided",
    },
  )
  .refine(
    (data) =>
      data.fulfillmentStatus === undefined || data.status === "COMPLETED"
        ? true
        : data.fulfillmentStatus !== "COMPLETED",
    {
      message: "Use order status to complete the order; fulfillment groups cannot be set to completed directly",
    },
  );

export type AdminOrderPatchInput = z.infer<typeof AdminOrderPatchSchema>;
