import { z } from "zod";
import { VENDOR_PERMISSION_CODES } from "../vendor-permissions";

export const VendorTeamInviteSchema = z.object({
  email: z.string().trim().email().max(255),
  permissions: z
    .array(z.enum(VENDOR_PERMISSION_CODES))
    .min(1, { message: "Select at least one permission" })
    .refine((codes) => !codes.includes("vendor:team:edit"), {
      message: "Team admin cannot be granted via invite.",
    }),
});

export type VendorTeamInviteInput = z.infer<typeof VendorTeamInviteSchema>;

export const VendorTeamAcceptSchema = z.object({
  token: z.string().trim().min(1).max(64),
});

export type VendorTeamAcceptInput = z.infer<typeof VendorTeamAcceptSchema>;
