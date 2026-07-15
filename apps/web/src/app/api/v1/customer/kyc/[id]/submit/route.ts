import { NextRequest } from "next/server";
import { handleKycSubmit } from "@/lib/kyc-api-handlers";
import { requireCustomerSession } from "@/lib/require-customer-session";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireCustomerSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  return handleKycSubmit({ subjectType: "CUSTOMER", userId: auth.userId }, id);
}
