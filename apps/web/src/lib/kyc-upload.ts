import type { KycDocumentType } from "@mlm/db";
import { buildKycSubjectKey } from "@mlm/domain";
import type { KycSubjectType } from "@mlm/db";
import { sniffMatchesDeclaredMime } from "@/lib/file-sniff";
import {
  extensionFromFileName,
  extensionFromKycMime,
  isAllowedKycDocumentMime,
  isAllowedKycFile,
  MAX_KYC_DOCUMENT_BYTES,
} from "@/lib/kyc-storage/mime";
import { storeKycDocument } from "@/lib/kyc-storage/store";

export type ParsedKycUpload = {
  documentType: KycDocumentType;
  buffer: Buffer;
  mimeType: string;
  extension: string;
  originalFileName: string;
  fileSizeBytes: number;
  documentExpiresAt: Date | null;
  ibanNumber: string | null;
};

const DOCUMENT_TYPES = new Set<KycDocumentType>([
  "NATIONAL_ID",
  "IBAN",
  "COMMERCIAL_REGISTRATION",
  "LICENSE",
  "TAX_CERTIFICATE",
  "REPRESENTATIVE_ID",
]);

export async function parseKycUploadForm(
  form: FormData,
): Promise<ParsedKycUpload | { error: string }> {
  const file = form.get("file");
  const documentTypeRaw = String(form.get("documentType") ?? "").trim();

  if (!(file instanceof File)) {
    return { error: "Missing file" };
  }

  if (!DOCUMENT_TYPES.has(documentTypeRaw as KycDocumentType)) {
    return { error: "Invalid document type" };
  }

  if (!isAllowedKycFile(file)) {
    return { error: "Unsupported file type. Only PDF, JPEG, JPG, or PNG are allowed." };
  }

  if (file.size > MAX_KYC_DOCUMENT_BYTES) {
    return { error: "File must be 10MB or smaller." };
  }

  const extension = extensionFromKycMime(file.type) ?? extensionFromFileName(file.name);
  if (!extension) {
    return { error: "Unsupported file type. Only PDF, JPEG, JPG, or PNG are allowed." };
  }

  const expiresRaw = String(form.get("documentExpiresAt") ?? "").trim();
  const documentExpiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresRaw && Number.isNaN(documentExpiresAt?.getTime())) {
    return { error: "Invalid expiry date." };
  }

  const ibanNumber = String(form.get("ibanNumber") ?? "").trim() || null;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!sniffMatchesDeclaredMime(buffer, file.type || "")) {
    return { error: "File content does not match the declared type." };
  }

  return {
    documentType: documentTypeRaw as KycDocumentType,
    buffer,
    mimeType: file.type,
    extension,
    originalFileName: file.name.slice(0, 255),
    fileSizeBytes: file.size,
    documentExpiresAt,
    ibanNumber,
  };
}

export async function persistKycUpload(params: {
  subjectType: KycSubjectType;
  subjectId: string;
  parsed: ParsedKycUpload;
}): Promise<{ storageKey: string }> {
  const subjectKey = buildKycSubjectKey(params.subjectType, params.subjectId);
  return storeKycDocument({
    subjectKey,
    buffer: params.parsed.buffer,
    contentType: parsedMimeType(params.parsed.mimeType),
    extension: params.parsed.extension,
  });
}

function parsedMimeType(mime: string): string {
  return mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime;
}
