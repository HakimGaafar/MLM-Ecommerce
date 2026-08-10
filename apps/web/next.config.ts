import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SECURITY_HEADERS } from "./src/lib/security-headers";
import { getCdnImageHostnames } from "./src/lib/storage/config";

const cdnHostnames = getCdnImageHostnames();
const configDir = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root — required so standalone tracing includes workspace packages. */
const monorepoRoot = path.join(configDir, "../..");

const nextConfig: NextConfig = {
  // Hostinger Node.js SSR: bundle a minimal server + deps (avoids missing `next` at runtime).
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@mlm/shared", "@mlm/domain", "@mlm/db", "@mlm/queue"],
  /** pdfkit loads Helvetica.afm from disk; must not be bundled by Turbopack. */
  serverExternalPackages: ["pdfkit", "@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/pdfkit/js/data/**",
      "../../node_modules/pdfkit/js/data/**",
      "../../node_modules/.prisma/**",
      "../../node_modules/@prisma/client/**",
      "../../packages/db/prisma/**",
    ],
  },
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
