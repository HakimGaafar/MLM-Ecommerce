import {
  createAdminProductCategory,
  listAdminProductCategories,
} from "@mlm/domain";
import { AdminProductCategoryUpsertSchema, getMarketId, isMarketCode } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

function resolveMarketId(request: NextRequest): string | null {
  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  if (marketCode && isMarketCode(marketCode)) return getMarketId(marketCode);
  return request.nextUrl.searchParams.get("marketId")?.trim() || null;
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const marketId = resolveMarketId(request);
  if (!marketId) {
    return NextResponse.json({ error: "marketCode or marketId is required" }, { status: 400 });
  }

  const categories = await listAdminProductCategories(marketId);
  return NextResponse.json({ categories }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const marketId = resolveMarketId(request);
  if (!marketId) {
    return NextResponse.json({ error: "marketCode or marketId is required" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AdminProductCategoryUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const category = await createAdminProductCategory({ marketId, input: parsed.data });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Category slug already exists for this market." }, { status: 409 });
    }
    throw error;
  }
}
