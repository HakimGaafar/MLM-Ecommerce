import {
  listAdminLegalPolicyVersions,
  upsertAdminLegalPolicyVersion,
} from "@mlm/domain";
import {
  AdminLegalPolicyVersionUpsertSchema,
  LEGAL_DOCUMENT_TYPES,
  isMarketCode,
  type LegalDocumentType,
  type MarketCode,
} from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  if (!marketCode || !isMarketCode(marketCode)) {
    return NextResponse.json({ error: "Valid marketCode is required" }, { status: 400 });
  }

  const documentTypeRaw = request.nextUrl.searchParams.get("documentType")?.trim().toUpperCase();
  const documentType =
    documentTypeRaw && (LEGAL_DOCUMENT_TYPES as readonly string[]).includes(documentTypeRaw)
      ? (documentTypeRaw as LegalDocumentType)
      : undefined;

  try {
    const policies = await listAdminLegalPolicyVersions({
      marketCode: marketCode as MarketCode,
      documentType,
    });
    return NextResponse.json({ policies });
  } catch (error) {
    if (error instanceof Error && error.message === "MARKET_NOT_FOUND") {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(request, auth.userId, "admin-legal-policies", 40, 10 * 60 * 1000);
  if (limited) return limited;

  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  if (!marketCode || !isMarketCode(marketCode)) {
    return NextResponse.json({ error: "Valid marketCode is required" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AdminLegalPolicyVersionUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const policy = await upsertAdminLegalPolicyVersion({
      marketCode: marketCode as MarketCode,
      input: parsed.data,
    });
    return NextResponse.json({ policy });
  } catch (error) {
    if (error instanceof Error && error.message === "MARKET_NOT_FOUND") {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    throw error;
  }
}
