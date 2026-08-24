import { listShippingRates, updateShippingRateAmount } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rates = await listShippingRates();
  return NextResponse.json({ rates }, { headers: { "Cache-Control": "no-store" } });
}

const PatchSchema = z.object({
  code: z.string().trim().min(3).max(64),
  amount: z.coerce.number().min(0).max(1_000_000),
  perUnit: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const rate = await updateShippingRateAmount(parsed.data);
    return NextResponse.json({ rate }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Rate not found" }, { status: 404 });
  }
}
