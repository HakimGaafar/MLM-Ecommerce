"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Product grid thumbnail: shows remote/upload URL or the 🛒 placeholder when URL is missing or fails to load.
 */
export default function CatalogProductThumb({
  src,
  alt,
  sizes,
}: {
  src: string | null | undefined;
  alt: string;
  sizes: string;
}) {
  const [failed, setFailed] = useState(false);
  const trimmed = (src ?? "").trim();
  const showImage = trimmed.length > 0 && !failed;
  const unoptimized = trimmed.startsWith("/uploads/");

  if (!showImage) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-60" aria-hidden>
        🛒
      </div>
    );
  }

  return (
    <Image
      src={trimmed}
      alt={alt}
      fill
      className="object-cover"
      sizes={sizes}
      unoptimized={unoptimized}
      onError={() => setFailed(true)}
    />
  );
}
