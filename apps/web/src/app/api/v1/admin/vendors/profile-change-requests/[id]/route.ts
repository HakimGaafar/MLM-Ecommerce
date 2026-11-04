import { reviewVendorProfileChangeRequest, SellerOnboardError } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { z } from "zod";

const BodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().trim().max(2000).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const result = await reviewVendorProfileChangeRequest({
      requestId: id,
      actorUserId: auth.userId,
      action: parsed.data.action,
      adminNote: parsed.data.adminNote,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof SellerOnboardError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}
