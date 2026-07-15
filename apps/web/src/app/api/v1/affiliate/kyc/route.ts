import { NextRequest } from "next/server";
import { handleKycGet, handleKycUpload } from "@/lib/kyc-api-handlers";
import { requireAffiliateSession } from "@/lib/require-affiliate-session";

export async function GET(request: NextRequest) {
  const auth = await requireAffiliateSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });
  return handleKycGet({ subjectType: "AFFILIATE", userId: auth.userId });
}

export async function POST(request: NextRequest) {
  const auth = await requireAffiliateSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });
  return handleKycUpload(request, { subjectType: "AFFILIATE", userId: auth.userId }, auth.userId);
}
