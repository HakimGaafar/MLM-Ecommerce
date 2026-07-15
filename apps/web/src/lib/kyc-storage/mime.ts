const ALLOWED_MIMES = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);

export const MAX_KYC_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const KYC_ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function extensionFromFileName(fileName: string): "pdf" | "jpg" | "png" | null {
  const parts = fileName.trim().split(".");
  if (parts.length < 2) return null;
  const raw = parts.pop()?.toLowerCase();
  if (!raw || !ALLOWED_EXTENSIONS.has(raw)) return null;
  if (raw === "pdf") return "pdf";
  if (raw === "png") return "png";
  return "jpg";
}

export function isAllowedKycDocumentMime(mime: string): boolean {
  const normalized = mime.toLowerCase();
  if (!normalized) return false;
  return ALLOWED_MIMES.has(normalized);
}

export function isAllowedKycFile(file: Pick<File, "name" | "type">): boolean {
  const ext = extensionFromFileName(file.name);
  if (!ext) return false;
  if (file.type && !isAllowedKycDocumentMime(file.type)) return false;
  return true;
}

export function extensionFromKycMime(mime: string): "pdf" | "jpg" | "png" | null {
  const normalized = mime.toLowerCase();
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "image/png") return "png";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  return null;
}
