import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/lib/security-headers";
import { getCdnImageHostnames } from "./src/lib/storage/config";

const cdnHostnames = getCdnImageHostnames();

const nextConfig: NextConfig = {
  transpilePackages: ["@mlm/shared", "@mlm/domain", "@mlm/db", "@mlm/queue"],
  /** pdfkit loads Helvetica.afm from disk; must not be bundled by Turbopack. */
  serverExternalPackages: ["pdfkit", "@prisma/client", "prisma"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "**.unsplash.com", pathname: "/**" },
      ...cdnHostnames.map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/**",
      })),
    ],
  },
};

export default nextConfig;
