import { getVendorInvitePreview } from "@mlm/domain";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const preview = await getVendorInvitePreview(token);
  if (!preview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(preview, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
