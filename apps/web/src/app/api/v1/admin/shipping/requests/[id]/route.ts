import { reviewAdminShippingRequest, VendorShippingError } from "@mlm/domain";
import { AdminShippingRequestReviewSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = AdminShippingRequestReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const row = await reviewAdminShippingRequest(id, auth.userId, parsed.data);
    return NextResponse.json({ request: row }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorShippingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 404 });
    }
    throw e;
  }
}
