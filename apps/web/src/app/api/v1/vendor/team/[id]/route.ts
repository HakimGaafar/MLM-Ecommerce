import { revokeVendorTeamMember, VendorTeamError } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:team:edit");
  if (denied) return denied;

  const { id } = await context.params;
  try {
    await revokeVendorTeamMember(auth.vendorId, id, auth.userId);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorTeamError) {
      const status = e.code === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
