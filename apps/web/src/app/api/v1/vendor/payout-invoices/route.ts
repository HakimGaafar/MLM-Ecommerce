import {
  createVendorPayoutInvoice,
  listVendorPaidWithdrawalsNeedingInvoice,
  VendorPayoutInvoiceError,
} from "@mlm/domain";
import { VendorPayoutInvoiceCreateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { resolveRequestMarket } from "@/lib/request-market";
import { publicErrorPayload } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const market = await resolveRequestMarket();
  const items = await listVendorPaidWithdrawalsNeedingInvoice({
    ownerUserId: auth.userId,
    marketId: market.id,
  });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await request.json().catch(() => null);
  const parsed = VendorPayoutInvoiceCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const market = await resolveRequestMarket();
  try {
    const invoice = await createVendorPayoutInvoice({
      ownerUserId: auth.userId,
      marketId: market.id,
      input: parsed.data,
    });
    return NextResponse.json({ invoice }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorPayoutInvoiceError) {
      const status =
        e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : e.code === "ALREADY_EXISTS" ? 409 : 400;
      return NextResponse.json(publicErrorPayload(e, { context: "vendor/payout-invoices", code: e.code }), {
        status,
      });
    }
    throw e;
  }
}
