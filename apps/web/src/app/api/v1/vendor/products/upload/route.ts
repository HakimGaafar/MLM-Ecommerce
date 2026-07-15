import { NextRequest, NextResponse } from "next/server";
import { sniffMatchesDeclaredMime } from "@/lib/file-sniff";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";
import { getProductImageStorage } from "@/lib/storage";
import {
  extensionFromImageMime,
  isAllowedProductImageMime,
  MAX_PRODUCT_IMAGE_BYTES,
} from "@/lib/storage/mime";

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:products:write");
  if (denied) return denied;

  const limited = await enforceUserRateLimit(
    request,
    auth.userId,
    "product-upload",
    30,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!isAllowedProductImageMime(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
  }

  const extension = extensionFromImageMime(file.type);
  if (!extension) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  try {
    const storage = getProductImageStorage();
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!sniffMatchesDeclaredMime(buffer, file.type)) {
      return NextResponse.json(
        { error: "Image content does not match the declared type." },
        { status: 400 },
      );
    }
    const { url } = await storage.uploadProductImage({
      vendorId: auth.vendorId,
      buffer,
      contentType: file.type,
      extension,
    });

    return NextResponse.json({ url }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Product image upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
