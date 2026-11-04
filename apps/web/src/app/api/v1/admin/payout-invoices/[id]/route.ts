import { reviewVendorPayoutInvoice, VendorPayoutInvoiceError } from "@mlm/domain";
import { VendorPayoutInvoiceReviewSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { resolveRequestMarket } from "@/lib/request-market";
import { publicErrorPayload } from "@/lib/api-error-response";

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = VendorPayoutInvoiceReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const market = await resolveRequestMarket();
  try {
    const invoice = await reviewVendorPayoutInvoice({
      invoiceId: id,
      marketId: market.id,
      reviewerUserId: auth.userId,
      input: parsed.data,
    });
    return NextResponse.json({ invoice }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorPayoutInvoiceError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json(publicErrorPayload(e, { context: "admin/payout-invoices", code: e.code }), {
        status,
      });
    }
    throw e;
  }
}
