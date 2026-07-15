import { z } from "zod";

export const VendorOrderStatusUpdateSchema = z.object({
  status: z.enum(["NEW", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"]),
});

export type VendorOrderStatusUpdateInput = z.infer<typeof VendorOrderStatusUpdateSchema>;
