import { getStorageConfig } from "./config";
import { createLocalProductImageStorage } from "./local";
import { createS3ProductImageStorage } from "./s3";
import type { ProductImageStorage } from "./types";

let storage: ProductImageStorage | null = null;

export function getProductImageStorage(): ProductImageStorage {
  if (storage) return storage;

  const config = getStorageConfig();
  storage =
    config.provider === "s3"
      ? createS3ProductImageStorage(config)
      : createLocalProductImageStorage();

  return storage;
}

export type { ProductImageStorage, ProductImageUploadInput } from "./types";
export { getStorageConfig, getCdnImageHostnames } from "./config";
