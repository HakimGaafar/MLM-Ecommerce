/**
 * Hostinger entry file (set "Entry file" to server.js when not using npm start).
 * Boots the Next.js standalone server produced by `npm run build`.
 */
const fs = require("node:fs");
const path = require("node:path");

process.env.NODE_ENV ||= "production";
process.env.HOSTNAME ||= "0.0.0.0";
process.env.PORT ||= "3000";

const candidates = [
  path.join(__dirname, "apps", "web", ".next", "standalone", "apps", "web", "server.js"),
  path.join(__dirname, "apps", "web", ".next", "standalone", "server.js"),
  path.join(__dirname, ".next", "standalone", "apps", "web", "server.js"),
  path.join(__dirname, ".next", "standalone", "server.js"),
];

const serverPath = candidates.find((candidate) => fs.existsSync(candidate));

if (!serverPath) {
  console.error(
    "[server.js] Standalone server missing. On Hostinger use Root Directory `.`, Build `npm run build`, then Start `npm run start` (or Entry file `server.js`).",
  );
  process.exit(1);
}

process.chdir(path.dirname(serverPath));
require(serverPath);
