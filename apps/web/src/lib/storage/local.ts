import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ProductImageStorage, ProductImageUploadInput } from "./types";

export function createLocalProductImageStorage(): ProductImageStorage {
  return {
    async uploadProductImage(input: ProductImageUploadInput) {
      const filename = `${input.vendorId}-${randomUUID()}.${input.extension}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), input.buffer);

      return { url: `/uploads/products/${filename}` };
    },
  };
}
