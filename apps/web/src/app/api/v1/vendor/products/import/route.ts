import {
  VendorProductImportError,
  importVendorProductsFromCsv,
} from "@mlm/domain";
import { VendorProductImportRequestSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestLocale } from "@/lib/ui-locale";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:products:write");
  if (denied) return denied;

  const raw = await request.json().catch(() => null);
  const parsed = VendorProductImportRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const locale = await resolveRequestLocale(request);

  try {
    const result = await importVendorProductsFromCsv(auth.vendorId, parsed.data.csv, locale);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorProductImportError) {
      const status =
        e.code === "TOO_MANY_ROWS" ? 413 : e.code === "EMPTY" || e.code === "NO_ROWS" ? 400 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
