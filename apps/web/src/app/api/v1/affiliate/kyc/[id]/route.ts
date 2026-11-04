import { NextRequest } from "next/server";
import { handleKycDiscard } from "@/lib/kyc-api-handlers";
import { requireAffiliateSession } from "@/lib/require-affiliate-session";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAffiliateSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  return handleKycDiscard({ subjectType: "AFFILIATE", userId: auth.userId }, id);
}
