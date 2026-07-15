import {
  deleteCustomerShippingAddress,
  updateCustomerShippingAddress,
} from "@mlm/domain";
import { CustomerShippingAddressUpdateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  if (!id?.trim()) return NextResponse.json({ error: "Invalid address id" }, { status: 400 });

  const raw = await request.json().catch(() => null);
  const parsed = CustomerShippingAddressUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updateCustomerShippingAddress(auth.userId, id, parsed.data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  if (!id?.trim()) return NextResponse.json({ error: "Invalid address id" }, { status: 400 });

  const ok = await deleteCustomerShippingAddress(auth.userId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
