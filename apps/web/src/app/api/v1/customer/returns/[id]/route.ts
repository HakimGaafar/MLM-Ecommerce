import { CustomerReturnError, getCustomerReturnDetail } from "@mlm/domain";
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
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid return id" }, { status: 400 });
  }

  const detail = await getCustomerReturnDetail(auth.userId, id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}
