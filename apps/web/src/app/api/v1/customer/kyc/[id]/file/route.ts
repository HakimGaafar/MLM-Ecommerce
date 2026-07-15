import { NextRequest } from "next/server";
import { handleKycFileDownload } from "@/lib/kyc-api-handlers";
import { requireCustomerSession } from "@/lib/require-customer-session";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireCustomerSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  return handleKycFileDownload({ subjectType: "CUSTOMER", userId: auth.userId }, id);
}
