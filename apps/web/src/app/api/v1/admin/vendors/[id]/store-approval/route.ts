import { AdminVendorStoreError, setVendorStoreApproval } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/require-admin-session";

const BodySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]),
  note: z.string().trim().max(500).optional().nullable(),
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
    const vendor = await setVendorStoreApproval({
      vendorId: id,
      status: parsed.data.status,
      adminUserId: auth.userId,
      note: parsed.data.note,
    });
    return NextResponse.json({ vendor }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AdminVendorStoreError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "NOT_READY" ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
