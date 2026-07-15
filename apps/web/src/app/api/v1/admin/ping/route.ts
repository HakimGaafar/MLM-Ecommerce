import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(
    {
      ok: true,
      scope: "admin",
      message: "Admin session verified.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
