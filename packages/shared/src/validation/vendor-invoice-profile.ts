import { z } from "zod";

export const VendorInvoiceProfileSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  vatTrn: z.string().trim().min(5).max(32).optional().nullable(),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(120),
  postalCode: z.string().trim().min(2).max(20),
  countryCode: z.string().trim().length(2).toUpperCase(),
  logoUrl: z.string().trim().url().max(500).optional().nullable(),
});

export type VendorInvoiceProfileInput = z.infer<typeof VendorInvoiceProfileSchema>;
