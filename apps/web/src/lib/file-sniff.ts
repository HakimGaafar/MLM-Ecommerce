export type SniffedFileKind = "pdf" | "jpeg" | "png" | "gif" | "webp";

export function sniffFileKind(buffer: Buffer): SniffedFileKind | null {
  if (buffer.length < 12) return null;

  if (buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return "pdf";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngSig.every((byte, index) => buffer[index] === byte)) {
    return "png";
  }

  if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") {
    return "gif";
  }

  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }

  return null;
}

export function sniffMatchesDeclaredMime(buffer: Buffer, mime: string): boolean {
  const kind = sniffFileKind(buffer);
  if (!kind) return false;

  const normalized = mime.toLowerCase();
  if (normalized === "application/pdf") return kind === "pdf";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return kind === "jpeg";
  if (normalized === "image/png") return kind === "png";
  if (normalized === "image/gif") return kind === "gif";
  if (normalized === "image/webp") return kind === "webp";
  return false;
}
