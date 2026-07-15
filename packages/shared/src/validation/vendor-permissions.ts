import { z } from "zod";
import { VENDOR_PERMISSION_CODES } from "../vendor-permissions";

export const VendorPermissionsUpdateSchema = z.object({
  codes: z.array(z.enum(VENDOR_PERMISSION_CODES)),
});
