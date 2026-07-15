import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import type { S3StorageConfig } from "./config";
import type { ProductImageStorage, ProductImageUploadInput } from "./types";

export function createS3ProductImageStorage(config: S3StorageConfig): ProductImageStorage {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
  });

  return {
    async uploadProductImage(input: ProductImageUploadInput) {
      const key = `${config.keyPrefix}/${input.vendorId}/${randomUUID()}.${input.extension}`;

      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: input.buffer,
          ContentType: input.contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );

      return { url: `${config.cdnBaseUrl}/${key}` };
    },
  };
}
