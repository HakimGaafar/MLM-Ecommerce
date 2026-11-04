import { previewReturnCostForOrder } from "@mlm/domain";
import { OrderReturnReasonSchema } from "@mlm/shared";
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
  const reasonParam = request.nextUrl.searchParams.get("reason");
  const reasonParsed = reasonParam ? OrderReturnReasonSchema.safeParse(reasonParam) : null;
  const reason = reasonParsed?.success ? reasonParsed.data : null;

  const estimate = await previewReturnCostForOrder(auth.userId, id, reason);
  if (!estimate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ estimate }, { headers: { "Cache-Control": "no-store" } });
}
