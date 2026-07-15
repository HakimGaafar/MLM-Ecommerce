import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      scope: "vendor",
      message: "Vendor protected route reachable.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
