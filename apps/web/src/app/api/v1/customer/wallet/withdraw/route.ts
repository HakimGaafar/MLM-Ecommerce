import { AffiliateWithdrawalError, requestAffiliateWithdrawal } from "@mlm/domain";
import { WalletWithdrawSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(request, auth.userId, "withdraw", 5, 15 * 60 * 1000);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, WalletWithdrawSchema);
  if ("error" in parsed) return parsed.error;

  const { amount, kycSubject } = parsed.data;
  const market = await resolveRequestMarket();

  try {
    const item = await requestAffiliateWithdrawal({
      userId: auth.userId,
      amount,
      marketId: market.id,
      kycSubject,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof AffiliateWithdrawalError) {
      const status =
        error.code === "INSUFFICIENT_BALANCE"
          ? 409
          : error.code === "KYC_NOT_APPROVED" || error.code === "KYC_ID_EXPIRED"
            ? 403
            : error.code === "INVALID_AMOUNT" || error.code === "BELOW_MINIMUM"
              ? 400
              : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
