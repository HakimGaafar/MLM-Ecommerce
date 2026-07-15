import { createVendorProduct, listVendorProducts, VendorProductError } from "@mlm/domain";
import { VendorProductCreateSchema, VendorProductListQuerySchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestLocale } from "@/lib/ui-locale";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:products:read");
  if (denied) return denied;

  const query = VendorProductListQuerySchema.safeParse({
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });
  const locale = await resolveRequestLocale(request);
  const result = await listVendorProducts(
    auth.vendorId,
    query.success
      ? { status: query.data.status, page: query.data.page, pageSize: query.data.pageSize }
      : undefined,
    locale,
  );
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:products:write");
  if (denied) return denied;

  const raw = await request.json().catch(() => null);
  const parsed = VendorProductCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const product = await createVendorProduct(auth.vendorId, {
      ...parsed.data,
      currency: parsed.data.currency ?? "SAR",
    });
    return NextResponse.json({ product }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorProductError && e.code === "INVALID_CATEGORY") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
