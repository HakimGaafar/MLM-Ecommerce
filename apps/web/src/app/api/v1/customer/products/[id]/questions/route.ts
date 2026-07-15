import { ProductQuestionCreateSchema } from "@mlm/shared";
import { ProductQuestionError, createProductQuestion } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: productId } = await context.params;
  if (!productId?.trim()) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = ProductQuestionCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createProductQuestion(auth.userId, productId, parsed.data);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ProductQuestionError) {
      const status = e.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
