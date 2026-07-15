import {
  getVendorPermissionState,
  setVendorPermissions,
  VendorPermissionError,
} from "@mlm/domain";
import { VendorPermissionsUpdateSchema } from "@mlm/shared";
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
  const state = await getVendorPermissionState(id);
  if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = VendorPermissionsUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const state = await setVendorPermissions(id, parsed.data.codes, auth.userId);
    return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorPermissionError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
