import { NextRequest } from "next/server";
import { handleKycGet, handleKycUpload } from "@/lib/kyc-api-handlers";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:wallet:read");
  if (denied) return denied;

  return handleKycGet({ subjectType: "VENDOR", vendorId: auth.vendorId });
}

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:wallet:edit");
  if (denied) return denied;

  return handleKycUpload(
    request,
    { subjectType: "VENDOR", vendorId: auth.vendorId },
    auth.userId,
  );
}
