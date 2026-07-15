import { z } from "zod";

export const AdminMarketActiveUpdateSchema = z.object({
  isActive: z.boolean(),
});

export type AdminMarketActiveUpdateInput = z.infer<typeof AdminMarketActiveUpdateSchema>;
