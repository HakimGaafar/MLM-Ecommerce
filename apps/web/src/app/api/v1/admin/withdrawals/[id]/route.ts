import {
  AdminWithdrawalError,
  approveAdminWithdrawal,
  declineAdminWithdrawal,
  markAdminWithdrawalPaid,
} from "@mlm/domain";
import { AdminWithdrawalPatchSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(
    request,
    auth.userId,
    "admin-withdrawal",
    30,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, AdminWithdrawalPatchSchema);
  if ("error" in parsed) return parsed.error;

  try {
    if (parsed.data.action === "approve") {
      const item = await approveAdminWithdrawal(id, auth.userId);
      return NextResponse.json({ item });
    }
    if (parsed.data.action === "decline") {
      const item = await declineAdminWithdrawal(id, auth.userId);
      return NextResponse.json({ item });
    }
    const item = await markAdminWithdrawalPaid(id, auth.userId, parsed.data.bankReference);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AdminWithdrawalError) {
      const status = error.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
