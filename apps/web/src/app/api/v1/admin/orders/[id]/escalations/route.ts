import { createOrderEscalation, listOrderEscalations, OrderEscalationError } from "@mlm/domain";
import { OrderEscalationCreateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const escalations = await listOrderEscalations(id);
  return NextResponse.json({ escalations }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = OrderEscalationCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const escalation = await createOrderEscalation({
      orderId: id,
      vendorId: parsed.data.vendorId,
      fulfillmentType: parsed.data.fulfillmentType,
      level: parsed.data.level,
      message: parsed.data.message,
      createdByUserId: auth.userId,
    });
    return NextResponse.json({ escalation }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof OrderEscalationError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
