import {
  listAdminMarketInvoicingRules,
  upsertAdminMarketInvoicingRule,
} from "@mlm/domain";
import { AdminMarketInvoicingRuleUpsertSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rules = await listAdminMarketInvoicingRules();
  return NextResponse.json({ rules });
}

export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(request, auth.userId, "admin-invoicing-rules", 40, 10 * 60 * 1000);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = AdminMarketInvoicingRuleUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const rule = await upsertAdminMarketInvoicingRule(parsed.data);
    return NextResponse.json({ rule });
  } catch (error) {
    if (error instanceof Error && error.message === "MARKET_NOT_FOUND") {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    throw error;
  }
}
