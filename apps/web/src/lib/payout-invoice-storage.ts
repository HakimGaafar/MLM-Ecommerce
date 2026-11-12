import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

/**
 * On-disk path for a payout invoice key.
 * Default uses literal segments so Turbopack NFT stays scoped.
 * Absolute PAYOUT_INVOICE_LOCAL_DIR overrides are supported.
 */
function localPathForKey(storageKey: string): string {
  const filename = path.basename(storageKey);
  const override = process.env.PAYOUT_INVOICE_LOCAL_DIR?.trim();
  if (override && path.isAbsolute(override)) {
    return path.join(override, filename);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "payout-invoices", filename);
}

function legacyPublicPath(filename: string): string {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    "uploads",
    "payout-invoices",
    filename,
  );
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
  const dir = path.dirname(fullPath);
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ fullPath, params.buffer);
  return { storageKey };
}

export async function readPayoutInvoiceFile(storageKey: string): Promise<Buffer | null> {
  const key = storageKey.trim();
  if (!key) return null;

  // Legacy public uploads (pre-private storage).
  if (key.startsWith("/uploads/payout-invoices/")) {
    const filename = path.basename(key);
    const legacyPath = legacyPublicPath(filename);
    try {
      return await readFile(/*turbopackIgnore: true*/ legacyPath);
    } catch {
      return null;
    }
  }

  if (!key.startsWith("payout-invoices/")) return null;
  const fullPath = localPathForKey(key);
  try {
    return await readFile(/*turbopackIgnore: true*/ fullPath);
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
