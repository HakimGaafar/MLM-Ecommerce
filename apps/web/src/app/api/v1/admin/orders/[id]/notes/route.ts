import { createOrderAdminNote, listOrderAdminNotes } from "@mlm/domain";
import { OrderAdminNoteCreateSchema } from "@mlm/shared";
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
  const notes = await listOrderAdminNotes(id);
  return NextResponse.json({ notes }, { headers: { "Cache-Control": "no-store" } });
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
  const parsed = OrderAdminNoteCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const note = await createOrderAdminNote({
    orderId: id,
    body: parsed.data.body,
    createdByUserId: auth.userId,
  });
  return NextResponse.json({ note }, { headers: { "Cache-Control": "no-store" } });
}
