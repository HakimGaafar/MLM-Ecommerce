import { AdminUserError, promoteUserToAdmin } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";
import { invalidateUserSessions } from "@/lib/session-invalidation";

function errorResponse(error: AdminUserError) {
  const status =
    error.code === "NOT_FOUND"
      ? 404
      : error.code === "FORBIDDEN"
        ? 403
        : error.code === "ALREADY_ADMIN" || error.code === "SELF_PROMOTE"
          ? 409
          : 400;
  return NextResponse.json({ error: error.message, code: error.code }, { status });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const targetUserId = id?.trim();
  if (!targetUserId) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  try {
    const user = await promoteUserToAdmin({
      actorUserId: auth.userId,
      targetUserId,
    });
    // Force re-auth so the new ADMIN role is in the access JWT immediately.
    try {
      await invalidateUserSessions(targetUserId);
    } catch {
      /* Role already granted; refresh will also pick up new roles. */
    }
    return NextResponse.json({ user }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminUserError) return errorResponse(error);
    throw error;
  }
}
