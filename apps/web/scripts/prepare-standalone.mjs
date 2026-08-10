import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(webRoot, ".next", "standalone");
const nestedAppRoot = path.join(standaloneRoot, "apps", "web");
const appRoot = existsSync(path.join(nestedAppRoot, "server.js"))
  ? nestedAppRoot
  : standaloneRoot;

if (!existsSync(path.join(appRoot, "server.js"))) {
  console.error(
    "[prepare-standalone] Missing standalone server.js. Ensure next.config has output: 'standalone'.",
  );
  process.exit(1);
}

const publicDir = path.join(webRoot, "public");
const staticDir = path.join(webRoot, ".next", "static");
const targetPublic = path.join(appRoot, "public");
const targetStatic = path.join(appRoot, ".next", "static");

if (existsSync(publicDir)) {
  mkdirSync(path.dirname(targetPublic), { recursive: true });
  cpSync(publicDir, targetPublic, { recursive: true });
}

if (existsSync(staticDir)) {
  mkdirSync(path.dirname(targetStatic), { recursive: true });
  cpSync(staticDir, targetStatic, { recursive: true });
}

console.log(`[prepare-standalone] Ready at ${appRoot}`);
