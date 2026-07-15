import { listCustomerOrderInvoices } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const invoices = await listCustomerOrderInvoices(auth.userId, id);
  return NextResponse.json({ invoices }, { headers: { "Cache-Control": "no-store" } });
}
