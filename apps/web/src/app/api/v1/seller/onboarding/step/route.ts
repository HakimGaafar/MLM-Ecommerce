import { advanceVendorOnboardingStep, SellerOnboardError } from "@mlm/domain";
import {
  VendorOnboardingFinancialSchema,
  VendorOnboardingLegalSchema,
  VendorOnboardingPersonalSchema,
  VendorOnboardingStoreSchema,
} from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { z } from "zod";

const BodySchema = z.object({
  step: z.number().int().min(2).max(5),
  data: z.record(z.string(), z.unknown()),
});

const schemas: Record<number, z.ZodTypeAny> = {
  2: VendorOnboardingPersonalSchema,
  3: VendorOnboardingLegalSchema,
  4: VendorOnboardingStoreSchema,
  5: VendorOnboardingFinancialSchema,
};

export async function PATCH(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized || !auth.vendorId || !auth.isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const pageSchema = schemas[parsed.data.step];
  if (!pageSchema) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }
  const pageParsed = pageSchema.safeParse(parsed.data.data);
  if (!pageParsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: pageParsed.error.flatten() }, { status: 400 });
  }

  try {
    const vendor = await advanceVendorOnboardingStep({
      vendorId: auth.vendorId,
      ownerUserId: auth.userId,
      step: parsed.data.step + 1,
      data: pageParsed.data as Record<string, unknown>,
    });
    return NextResponse.json({ vendor }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof SellerOnboardError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}
