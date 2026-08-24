import { z } from "zod";
import {
  ADDRESS_REQUIRED_FIELDS,
  isAddressCountryCode,
  type AddressCountryCode,
} from "../address-catalog";
import {
  isValidSaShortNationalAddress,
  normalizeSaShortNationalAddress,
} from "./sa-short-national-address";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Phone must be 8-15 digits and may start with +");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalCoord = z.coerce
  .number()
  .min(-180)
  .max(180)
  .optional()
  .nullable()
  .transform((v) => (v == null || Number.isNaN(v) ? undefined : v));

const baseAddressFields = {
  label: optionalText(80),
  recipientName: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  countryCode: z.string().trim().length(2).toUpperCase(),
  governorate: optionalText(120),
  city: z.string().trim().min(1).max(120),
  neighborhood: optionalText(120),
  building: optionalText(120),
  postalCode: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v ?? ""),
  addressLine1: z.string().trim().max(200).optional().transform((v) => v ?? ""),
  addressLine2: optionalText(200),
  fullAddress: optionalText(500),
  shortNationalAddress: optionalText(64),
  latitude: optionalCoord,
  longitude: optionalCoord,
  isDefault: z.boolean().optional(),
};

function refineCountryAddress(
  value: {
    countryCode: string;
    governorate?: string;
    city: string;
    neighborhood?: string;
    building?: string;
    postalCode: string;
    addressLine1: string;
    shortNationalAddress?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (!isAddressCountryCode(value.countryCode)) {
    // Allow other ISO countries with basic required fields only.
    return;
  }
  const country = value.countryCode as AddressCountryCode;
  const required = ADDRESS_REQUIRED_FIELDS[country];
  for (const key of required) {
    if (key === "street") {
      if (!value.addressLine1?.trim()) {
        ctx.addIssue({ code: "custom", message: "Street address is required.", path: ["addressLine1"] });
      }
      continue;
    }
    if (key === "city" && !value.city?.trim()) {
      ctx.addIssue({ code: "custom", message: "City is required.", path: ["city"] });
      continue;
    }
    if (key === "postalCode" && !value.postalCode?.trim()) {
      ctx.addIssue({ code: "custom", message: "Postal code is required.", path: ["postalCode"] });
      continue;
    }
    if (key === "governorate" && !value.governorate?.trim()) {
      ctx.addIssue({ code: "custom", message: "Governorate is required.", path: ["governorate"] });
      continue;
    }
    if (key === "neighborhood" && !value.neighborhood?.trim()) {
      ctx.addIssue({ code: "custom", message: "Neighborhood is required.", path: ["neighborhood"] });
      continue;
    }
    if (key === "building" && !value.building?.trim()) {
      ctx.addIssue({ code: "custom", message: "Building is required.", path: ["building"] });
    }
  }
  if (country === "SA" && value.shortNationalAddress?.trim()) {
    const normalized = normalizeSaShortNationalAddress(value.shortNationalAddress);
    if (!isValidSaShortNationalAddress(normalized)) {
      ctx.addIssue({
        code: "custom",
        message: "Short national address must be 4 letters followed by 4 digits (e.g. AREB1343).",
        path: ["shortNationalAddress"],
      });
    }
  }
}

export const CustomerShippingAddressCreateSchema = z
  .object(baseAddressFields)
  .transform((value) => ({
    ...value,
    shortNationalAddress: value.shortNationalAddress
      ? normalizeSaShortNationalAddress(value.shortNationalAddress)
      : value.shortNationalAddress,
  }))
  .transform((value) => {
    const cc = value.countryCode.toUpperCase();
    if (cc === "OM" && !value.addressLine1?.trim()) {
      const fallback =
        value.fullAddress?.trim() ||
        value.neighborhood?.trim() ||
        value.city?.trim() ||
        "—";
      return { ...value, addressLine1: fallback };
    }
    return value;
  })
  .superRefine(refineCountryAddress);

export type CustomerShippingAddressCreateInput = z.infer<typeof CustomerShippingAddressCreateSchema>;

export const CustomerShippingAddressUpdateSchema = z
  .object({
    label: z.string().trim().max(80).optional().transform((v) => (v === "" ? undefined : v)),
    recipientName: z.string().trim().min(1).max(120).optional(),
    phone: phoneSchema.optional(),
    countryCode: z.string().trim().length(2).toUpperCase().optional(),
    governorate: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v === "" || v == null ? null : v)),
    city: z.string().trim().min(1).max(120).optional(),
    neighborhood: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v === "" || v == null ? null : v)),
    building: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v === "" || v == null ? null : v)),
    postalCode: z.string().trim().min(1).max(20).optional(),
    addressLine1: z.string().trim().min(1).max(200).optional(),
    addressLine2: z.string().trim().max(200).optional().transform((v) => (v === "" ? null : v)),
    fullAddress: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => (v === "" || v == null ? null : v)),
    shortNationalAddress: z
      .string()
      .trim()
      .max(64)
      .optional()
      .nullable()
      .transform((v) => (v === "" || v == null ? null : v)),
    latitude: optionalCoord,
    longitude: optionalCoord,
  })
  .refine((payload) => Object.keys(payload).length > 0, { message: "At least one field is required" });

export type CustomerShippingAddressUpdateInput = z.infer<typeof CustomerShippingAddressUpdateSchema>;
