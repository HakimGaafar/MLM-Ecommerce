import { NextRequest } from "next/server";
import { handleKycDiscard } from "@/lib/kyc-api-handlers";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireVendorSession(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return Response.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:wallet:edit");
  if (denied) return denied;

  const { id } = await params;
  return handleKycDiscard({ subjectType: "VENDOR", vendorId: auth.vendorId }, id);
}
