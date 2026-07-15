import { z } from "zod";
import { PaginationQuerySchema } from "./pagination";

export const AdminProductApprovalListQuerySchema = PaginationQuerySchema.extend({
  tab: z
    .enum(["new_pending", "edit_pending", "approved", "rejected"])
    .default("new_pending"),
});
