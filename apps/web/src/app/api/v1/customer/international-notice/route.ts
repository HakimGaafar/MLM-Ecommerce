import { acceptInternationalShoppingNotice } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { isSameOriginRequest } from "@/lib/security";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const auth = await requireCustomerSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await acceptInternationalShoppingNotice(auth.userId);
  return NextResponse.json({ accepted: true });
}
