export type ProductImageUploadInput = {
  vendorId: string;
  buffer: Buffer;
  contentType: string;
  extension: "jpg" | "png" | "webp" | "gif";
};

export type ProductImageStorage = {
  uploadProductImage(input: ProductImageUploadInput): Promise<{ url: string }>;
};
