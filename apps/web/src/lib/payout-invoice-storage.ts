import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const LOCAL_DIR = (process.env.PAYOUT_INVOICE_LOCAL_DIR ?? "storage/payout-invoices").trim();

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function extensionForPayoutMime(mime: string): string | null {
  return EXT[mime] ?? null;
}

/** Internal storage key (not a public URL). */
export function buildPayoutInvoiceStorageKey(vendorId: string, ext: string): string {
  return `payout-invoices/${vendorId}-${randomUUID()}.${ext}`;
}

function localPathForKey(storageKey: string): string {
  const filename = path.basename(storageKey);
  return path.join(process.cwd(), LOCAL_DIR, filename);
}

export async function storePayoutInvoiceFile(params: {
  vendorId: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ storageKey: string }> {
  const ext = extensionForPayoutMime(params.contentType);
  if (!ext) throw new Error("Unsupported payout invoice content type.");
  const storageKey = buildPayoutInvoiceStorageKey(params.vendorId, ext);
  const fullPath = localPathForKey(storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, params.buffer);
  return { storageKey };
}

export async function readPayoutInvoiceFile(storageKey: string): Promise<Buffer | null> {
  const key = storageKey.trim();
  if (!key) return null;

  // Legacy public uploads (pre-private storage).
  if (key.startsWith("/uploads/payout-invoices/")) {
    const filename = path.basename(key);
    try {
      return await readFile(path.join(process.cwd(), "public", "uploads", "payout-invoices", filename));
    } catch {
      return null;
    }
  }

  if (!key.startsWith("payout-invoices/")) return null;
  try {
    return await readFile(localPathForKey(key));
  } catch {
    return null;
  }
}

export function contentTypeForPayoutKey(storageKey: string): string {
  const lower = storageKey.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
