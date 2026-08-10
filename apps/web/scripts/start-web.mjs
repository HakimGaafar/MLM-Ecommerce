import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  path.join(webRoot, ".next", "standalone", "apps", "web", "server.js"),
  path.join(webRoot, ".next", "standalone", "server.js"),
];

const serverPath = candidates.find((candidate) => existsSync(candidate));

if (!serverPath) {
  console.error(
    "[start-web] Standalone server not found. Run `npm run build` first (Hostinger needs output: 'standalone').",
  );
  process.exit(1);
}

process.env.NODE_ENV ??= "production";
process.env.HOSTNAME ??= "0.0.0.0";
process.env.PORT ??= "3000";

process.chdir(path.dirname(serverPath));
await import(pathToFileURL(serverPath).href);
