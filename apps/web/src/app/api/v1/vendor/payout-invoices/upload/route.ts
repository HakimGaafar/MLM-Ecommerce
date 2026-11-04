import { NextRequest, NextResponse } from "next/server";
import { sniffMatchesDeclaredMime } from "@/lib/file-sniff";
import {
  extensionForPayoutMime,
  storePayoutInvoiceFile,
} from "@/lib/payout-invoice-storage";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized || !auth.vendorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const denied = await requireVendorPermission(auth, "vendor:wallet:read");
  if (denied) return denied;

  const limited = await enforceUserRateLimit(
    request,
    auth.userId,
    "payout-invoice-upload",
    20,
    15 * 60 * 1000,
  );
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const ext = extensionForPayoutMime(file.type);
  if (!ext) {
    return NextResponse.json({ error: "Use PDF, JPG, or PNG." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 10MB or smaller." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffMatchesDeclaredMime(buffer, file.type)) {
    return NextResponse.json(
      { error: "File content does not match the declared type." },
      { status: 400 },
    );
  }

  const { storageKey } = await storePayoutInvoiceFile({
    vendorId: auth.vendorId,
    buffer,
    contentType: file.type,
  });

  return NextResponse.json(
    { fileStorageKey: storageKey, fileOriginalName: file.name },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
