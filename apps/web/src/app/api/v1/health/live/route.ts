import { NextResponse } from "next/server";

/** Liveness — process is up (no dependency checks). */
export async function GET() {
  return NextResponse.json(
    { ok: true, status: "live", timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
