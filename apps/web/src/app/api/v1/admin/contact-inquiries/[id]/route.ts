import { updateContactInquiryStatus } from "@mlm/domain";
import { AdminContactInquiryPatchSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/security";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!isSameOriginRequest(request, { requireOrigin: true })) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  const throttle = await consumeRateLimit(
    `admin-contact-update:${auth.userId}`,
    30,
    5 * 60 * 1000,
  );
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const { id } = await context.params;
  if (!/^[a-z0-9_-]{10,64}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid inquiry id." }, { status: 400 });
  }

  const parsed = await parseJsonBody(request, AdminContactInquiryPatchSchema);
  if ("error" in parsed) return parsed.error;

  const inquiry = await updateContactInquiryStatus(id, parsed.data.status);
  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
  }

  return NextResponse.json(
    { inquiry },
    { headers: { "Cache-Control": "no-store" } },
  );
}
