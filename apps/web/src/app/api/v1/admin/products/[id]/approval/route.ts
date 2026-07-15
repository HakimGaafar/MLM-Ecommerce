import { reviewPendingProduct } from "@mlm/domain";
import { AdminProductApprovalSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = AdminProductApprovalSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const product = await reviewPendingProduct(
    id,
    parsed.data.action,
    parsed.data.rejectionReason,
    auth.userId,
  );
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product }, { headers: { "Cache-Control": "no-store" } });
}
