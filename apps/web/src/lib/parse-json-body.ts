import type { ZodType } from "zod";
import { NextResponse } from "next/server";

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T } | { error: NextResponse }> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    return {
      error: NextResponse.json({ error: message }, { status: 400 }),
    };
  }
  return { data: parsed.data };
}
