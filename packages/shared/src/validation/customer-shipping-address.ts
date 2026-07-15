import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Phone must be 8-15 digits and may start with +");

export const CustomerShippingAddressCreateSchema = z.object({
  label: z.string().trim().max(80).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  recipientName: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  countryCode: z.string().trim().length(2).toUpperCase(),
  city: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(20),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  isDefault: z.boolean().optional(),
});

export type CustomerShippingAddressCreateInput = z.infer<typeof CustomerShippingAddressCreateSchema>;

export const CustomerShippingAddressUpdateSchema = z
  .object({
    label: z.string().trim().max(80).optional().transform((v) => (v === "" ? undefined : v)),
    recipientName: z.string().trim().min(1).max(120).optional(),
    phone: phoneSchema.optional(),
    countryCode: z.string().trim().length(2).toUpperCase().optional(),
    city: z.string().trim().min(1).max(120).optional(),
    postalCode: z.string().trim().min(1).max(20).optional(),
    addressLine1: z.string().trim().min(1).max(200).optional(),
    addressLine2: z.string().trim().max(200).optional().transform((v) => (v === "" ? null : v)),
  })
  .refine((payload) => Object.keys(payload).length > 0, { message: "At least one field is required" });

export type CustomerShippingAddressUpdateInput = z.infer<typeof CustomerShippingAddressUpdateSchema>;
