import {
  deleteAdminProductCategory,
  updateAdminProductCategory,
} from "@mlm/domain";
import { AdminProductCategoryUpsertSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { resolveAdminMarketIdFromRequest } from "@/lib/admin-market-code";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const marketId = await resolveAdminMarketIdFromRequest(request);
  if (!marketId) {
    return NextResponse.json({ error: "marketCode or marketId is required" }, { status: 400 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = AdminProductCategoryUpsertSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const category = await updateAdminProductCategory({
      categoryId: id,
      marketId,
      input: parsed.data,
    });
    return NextResponse.json({ category });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INVALID_PARENT") {
      return NextResponse.json({ error: "Invalid parent category." }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const marketId = await resolveAdminMarketIdFromRequest(request);
  if (!marketId) {
    return NextResponse.json({ error: "marketCode or marketId is required" }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    await deleteAdminProductCategory({ categoryId: id, marketId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (error.message === "HAS_PRODUCTS") {
      return NextResponse.json(
        { error: "Cannot delete a category that still has products." },
        { status: 409 },
      );
    }
    if (error.message === "HAS_CHILDREN") {
      return NextResponse.json(
        { error: "Cannot delete a category that still has child categories." },
        { status: 409 },
      );
    }
    throw error;
  }
}
