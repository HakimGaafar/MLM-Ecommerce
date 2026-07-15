import { VendorProductQuestionAnswerSchema } from "@mlm/shared";
import { VendorProductQuestionError, answerVendorProductQuestion } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:products:qna:edit");
  if (denied) return denied;

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = VendorProductQuestionAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await answerVendorProductQuestion(auth.vendorId, id, parsed.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorProductQuestionError) {
      const status =
        e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : e.code === "ALREADY_ANSWERED" ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
