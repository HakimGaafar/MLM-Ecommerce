import { NextRequest } from "next/server";
import { handleKycGet, handleKycUpload } from "@/lib/kyc-api-handlers";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function GET(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });
  return handleKycGet({ subjectType: "CUSTOMER", userId: auth.userId });
}

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });
  return handleKycUpload(request, { subjectType: "CUSTOMER", userId: auth.userId }, auth.userId);
}
