import { listVendorFormListOptions, VendorFormListError } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const listKey = request.nextUrl.searchParams.get("listKey")?.trim() ?? "";
  if (!listKey) {
    return NextResponse.json({ error: "listKey is required." }, { status: 400 });
  }

  try {
    const options = await listVendorFormListOptions({ listKey, activeOnly: true });
    return NextResponse.json(
      {
        options: options.map((o) => ({
          code: o.code,
          labelEn: o.labelEn,
          labelAr: o.labelAr,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    if (error instanceof VendorFormListError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
