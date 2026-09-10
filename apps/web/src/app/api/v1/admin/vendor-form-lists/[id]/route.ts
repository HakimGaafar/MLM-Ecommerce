import {
  deleteVendorFormListOption,
  updateVendorFormListOption,
  VendorFormListError,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

const PatchSchema = z.object({
  labelEn: z.string().trim().min(1).max(200).optional(),
  labelAr: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

function listErrorResponse(error: VendorFormListError) {
  const status =
    error.code === "NOT_FOUND"
      ? 404
      : error.code === "DUPLICATE_CODE"
        ? 409
        : 400;
  return NextResponse.json({ error: error.message, code: error.code }, { status });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const option = await updateVendorFormListOption(id, parsed.data);
    return NextResponse.json({ option }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VendorFormListError) return listErrorResponse(error);
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminSession(_request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  try {
    await deleteVendorFormListOption(id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VendorFormListError) return listErrorResponse(error);
    throw error;
  }
}
