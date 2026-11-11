import { z } from "zod";
import { MARKET_CODES } from "../market";
import { MARKET_LIFECYCLE_STATUSES } from "../gateway-currency";

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);

const marketCodeFormat = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,15}$/);

/** Start Add Market for a country that does not already have a market. */
export const AdminMarketWizardStartSchema = z.object({
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(2)
    .regex(/^[A-Z]{2}$/),
  /** Clone legal/rates/config templates from this market (locked default OM). */
  cloneFrom: z.enum(MARKET_CODES).optional().default("OM"),
});

export type AdminMarketWizardStartInput = z.infer<typeof AdminMarketWizardStartSchema>;

export const AdminMarketWizardPapersSchema = z.object({
  papersComplete: z.boolean(),
});

export type AdminMarketWizardPapersInput = z.infer<typeof AdminMarketWizardPapersSchema>;

/** Admin attests DNS/host for the market subdomain already resolves to the platform. */
export const AdminMarketWizardHostRoutingSchema = z.object({
  hostRoutingConfirmed: z.boolean(),
});

export type AdminMarketWizardHostRoutingInput = z.infer<typeof AdminMarketWizardHostRoutingSchema>;

export const AdminMarketWizardCommercialSchema = z.object({
  platformRate: z.coerce.number().min(0).max(0.5).optional(),
  platformRateCross: z.coerce.number().min(0).max(0.5).optional(),
  returnWindowDays: z.coerce.number().int().min(1).max(90).optional(),
  settlementWindowDays: z.coerce.number().int().min(1).max(60).optional(),
  codEnabled: z.boolean().optional(),
  vatRate: z.coerce.number().min(0).max(0.5).optional(),
});

export type AdminMarketWizardCommercialInput = z.infer<typeof AdminMarketWizardCommercialSchema>;

export const AdminMarketWizardIdentitySchema = z.object({
  nameEn: z.string().trim().min(2).max(120).optional(),
  nameAr: z.string().trim().min(2).max(120).optional(),
  defaultCurrency: currencyCode.optional(),
  paymentCurrencies: z.array(currencyCode).min(1).max(8).optional(),
  geoCountryCodes: z.array(z.string().trim().toUpperCase().length(2)).max(20).optional(),
});

export type AdminMarketWizardIdentityInput = z.infer<typeof AdminMarketWizardIdentitySchema>;

export const MarketLifecycleStatusSchema = z.enum(MARKET_LIFECYCLE_STATUSES);

export const AdminMarketWizardLoadSchema = z.object({
  marketCode: marketCodeFormat,
});
