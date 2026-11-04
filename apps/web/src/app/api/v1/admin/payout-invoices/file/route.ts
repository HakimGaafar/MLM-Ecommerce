import { prisma } from "@mlm/db";
import { isSafePayoutInvoiceStorageKeyShape } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import {
  contentTypeForPayoutKey,
  readPayoutInvoiceFile,
} from "@/lib/payout-invoice-storage";
import { requireAdminSession } from "@/lib/require-admin-session";

/** Authenticated admin download for payout invoice review. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const key = request.nextUrl.searchParams.get("key")?.trim() ?? "";
  if (!isSafePayoutInvoiceStorageKeyShape(key)) {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
  }

  const row = await prisma.vendorPayoutInvoice.findFirst({
    where: { fileStorageKey: key },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ error: "Invoice file not found" }, { status: 404 });

  const buffer = await readPayoutInvoiceFile(key);
  if (!buffer) return NextResponse.json({ error: "File not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentTypeForPayoutKey(key),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${key.split("/").pop() ?? "invoice"}"`,
    },
  });
}
