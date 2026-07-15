import { z } from "zod";

export const PREFERRED_LANGUAGES = ["en", "ar"] as const;

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

export const CustomerProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, "Phone must be 8-15 digits and may start with +")
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    countryCode: z.string().trim().length(2).toUpperCase().optional(),
    city: optionalTrimmedString(120),
    addressLine1: optionalTrimmedString(200),
    addressLine2: optionalTrimmedString(200),
    postalCode: optionalTrimmedString(20),
    shipSameAsBilling: z.boolean().optional(),
    shippingAddressLine1: optionalTrimmedString(200),
    shippingAddressLine2: optionalTrimmedString(200),
    shippingCity: optionalTrimmedString(120),
    shippingPostalCode: optionalTrimmedString(20),
    shippingCountryCode: z
      .string()
      .trim()
      .length(2)
      .toUpperCase()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    preferredLanguage: z.enum(PREFERRED_LANGUAGES).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required for profile update",
  })
  .superRefine((data, ctx) => {
    if (data.shipSameAsBilling !== false) return;
    const need = (ok: boolean, path: keyof typeof data, message: string) => {
      if (!ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
      }
    };
    need(Boolean(data.shippingAddressLine1?.trim()), "shippingAddressLine1", "Shipping street address is required");
    need(Boolean(data.shippingCity?.trim()), "shippingCity", "Shipping city is required");
    need(Boolean(data.shippingPostalCode?.trim()), "shippingPostalCode", "Shipping postal code is required");
    need(Boolean(data.shippingCountryCode?.trim()), "shippingCountryCode", "Shipping country code is required");
  });

export type CustomerProfileUpdateInput = z.infer<typeof CustomerProfileUpdateSchema>;
