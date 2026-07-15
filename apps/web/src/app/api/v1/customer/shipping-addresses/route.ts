import {
  createCustomerShippingAddress,
  listCustomerShippingAddresses,
} from "@mlm/domain";
import { CustomerShippingAddressCreateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function GET(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { page, pageSize } = parsePaginationSearchParams(request.nextUrl.searchParams);
  const result = await listCustomerShippingAddresses(auth.userId, { page, pageSize });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await request.json().catch(() => null);
  const parsed = CustomerShippingAddressCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const created = await createCustomerShippingAddress(auth.userId, parsed.data);
  return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
}
