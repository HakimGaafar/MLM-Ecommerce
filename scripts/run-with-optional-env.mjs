/**
 * Runs a command with repo-root `.env` loaded when present.
 * Hostinger injects env vars in the panel (no `.env` file required).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, "apps", "web", ".env"));

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-with-optional-env.mjs <command> [args...]");
  process.exit(1);
}

const result = spawnSync(args[0], args.slice(1), {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
