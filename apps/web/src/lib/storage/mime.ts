const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export function extensionFromImageMime(
  mime: string,
): "jpg" | "png" | "webp" | "gif" | null {
  if (!ALLOWED_TYPES.has(mime)) return null;
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export function isAllowedProductImageMime(mime: string) {
  return ALLOWED_TYPES.has(mime);
}
