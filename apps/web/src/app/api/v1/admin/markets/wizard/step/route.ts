import {
  AdminMarketWizardError,
  markMarketReady,
  setWizardPapersComplete,
  updateWizardCommercial,
  updateWizardIdentity,
  verifyWizardHostDns,
} from "@mlm/domain";
import {
  AdminMarketWizardCommercialSchema,
  AdminMarketWizardIdentitySchema,
  AdminMarketWizardPapersSchema,
  isMarketCodeFormat,
} from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(
    request,
    auth.userId,
    "admin-market-wizard-step",
    40,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  const step = request.nextUrl.searchParams.get("step")?.trim().toLowerCase();
  if (!marketCode || !isMarketCodeFormat(marketCode) || !step) {
    return NextResponse.json({ error: "marketCode and step are required" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);

  try {
    let state;
    if (step === "identity") {
      const parsed = AdminMarketWizardIdentitySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input." },
          { status: 400 },
        );
      }
      state = await updateWizardIdentity(marketCode, parsed.data);
    } else if (step === "commercial") {
      const parsed = AdminMarketWizardCommercialSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input." },
          { status: 400 },
        );
      }
      state = await updateWizardCommercial(marketCode, parsed.data);
    } else if (step === "papers") {
      const parsed = AdminMarketWizardPapersSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input." },
          { status: 400 },
        );
      }
      state = await setWizardPapersComplete(marketCode, parsed.data.papersComplete);
    } else if (step === "host" || step === "verify-host") {
      const verified = await verifyWizardHostDns(marketCode);
      return NextResponse.json({
        state: verified.state,
        dns: verified.dns,
      });
    } else if (step === "ready") {
      state = await markMarketReady(marketCode);
    } else {
      return NextResponse.json({ error: "Unknown step" }, { status: 400 });
    }
    return NextResponse.json({ state });
  } catch (error) {
    if (error instanceof AdminMarketWizardError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
