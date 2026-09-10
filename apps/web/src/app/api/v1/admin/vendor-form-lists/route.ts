import {
  createVendorFormListOption,
  listVendorFormListOptions,
  VendorFormListError,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

const CreateSchema = z.object({
  listKey: z.string().trim().min(1).max(64),
  code: z.string().trim().min(1).max(64),
  labelEn: z.string().trim().min(1).max(200),
  labelAr: z.string().trim().min(1).max(200),
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

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const listKey = request.nextUrl.searchParams.get("listKey")?.trim() ?? "LICENSE_TYPE";
  try {
    const options = await listVendorFormListOptions({ listKey, activeOnly: false });
    return NextResponse.json({ options }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VendorFormListError) return listErrorResponse(error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const option = await createVendorFormListOption(parsed.data);
    return NextResponse.json({ option }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VendorFormListError) return listErrorResponse(error);
    throw error;
  }
}
