import { cancelCustomerReturn, CustomerReturnError } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function POST(
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

  try {
    const result = await cancelCustomerReturn(auth.userId, id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof CustomerReturnError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "INVALID_CANCEL" ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
