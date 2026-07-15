import { createVendorTeamInvite, listVendorTeam, VendorTeamError } from "@mlm/domain";
import { PaginationQuerySchema, VendorTeamInviteSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:team:read");
  if (denied) return denied;

  const pageQuery = PaginationQuerySchema.safeParse({
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });
  const result = await listVendorTeam(
    auth.vendorId,
    pageQuery.success ? { page: pageQuery.data.page, pageSize: pageQuery.data.pageSize } : undefined,
  );
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:team:edit");
  if (denied) return denied;

  const raw = await request.json().catch(() => null);
  const parsed = VendorTeamInviteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const member = await createVendorTeamInvite(auth.vendorId, auth.userId, parsed.data);
    return NextResponse.json({ member }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorTeamError) {
      const status = e.code === "DUPLICATE" || e.code === "INVALID" ? 409 : e.code === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
