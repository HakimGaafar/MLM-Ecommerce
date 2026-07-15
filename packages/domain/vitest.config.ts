import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@mlm/db": path.resolve(rootDir, "../db/src/index.ts"),
      "@mlm/shared": path.resolve(rootDir, "../shared/src/index.ts"),
    },
  },
});
