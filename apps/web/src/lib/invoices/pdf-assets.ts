import { readFile } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

export async function loadInvoiceLogo(url: string | null | undefined): Promise<Buffer | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith("/")) {
      const filePath = path.join(process.cwd(), "public", trimmed.replace(/^\//, ""));
      if (!IMAGE_EXT.test(filePath)) return null;
      return await readFile(filePath);
    }

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const res = await fetch(trimmed, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) return null;
      return Buffer.from(await res.arrayBuffer());
    }
  } catch {
    return null;
  }

  return null;
}
