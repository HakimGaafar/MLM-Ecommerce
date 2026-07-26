import { listPasswordResetAudits } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

const ActionSchema = z.enum([
  "RESET_REQUESTED",
  "RESET_COMPLETED",
  "CHANGE_NOTIFICATION_SENT",
  "CHANGE_NOTIFICATION_FAILED",
]);

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rawAction = request.nextUrl.searchParams.get("action");
  const parsedAction = rawAction ? ActionSchema.safeParse(rawAction) : null;
  if (parsedAction && !parsedAction.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { page, pageSize } = parsePaginationSearchParams(request.nextUrl.searchParams);
  const result = await listPasswordResetAudits({
    page,
    pageSize,
    action: parsedAction?.success ? parsedAction.data : undefined,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
