import { createOrderCustomerNotice } from "@mlm/domain";
import { OrderCustomerNoticeCreateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function POST(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = OrderCustomerNoticeCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const notice = await createOrderCustomerNotice({
    orderId: id,
    type: parsed.data.type,
    body: parsed.data.body,
    createdByUserId: auth.userId,
  });
  return NextResponse.json({ notice }, { headers: { "Cache-Control": "no-store" } });
}
