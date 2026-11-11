import { deleteAdminMarketBanner, updateAdminMarketBanner } from "@mlm/domain";
import { AdminMarketBannerUpsertSchema } from "@mlm/shared";
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
  const parsed = AdminMarketBannerUpsertSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const banner = await updateAdminMarketBanner({
      bannerId: id,
      marketId,
      input: parsed.data,
    });
    return NextResponse.json({ banner });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
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
    await deleteAdminMarketBanner({ bannerId: id, marketId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }
    throw error;
  }
}
