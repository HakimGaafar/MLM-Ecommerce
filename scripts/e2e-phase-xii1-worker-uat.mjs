#!/usr/bin/env node
/**
 * Phase XII1 UAT — order complete → wallet credits (sync or async worker).
 * Requires: dev server, DB seeded, PHASE_XII_ENABLED=true + worker if queue mode.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const adminEmail = process.env.UAT_ADMIN_EMAIL ?? "admin@mlm.seed";
const adminPassword = process.env.UAT_ADMIN_PASSWORD ?? "SeedDemo123!";
const rewardSlaSec = Number.parseInt(process.env.REWARD_SLA_SECONDS ?? "60", 10);

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportPath = join(__dirname, "reports", "phase-xii1-uat-report.md");

async function jsonFetch(path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function login(email, password) {
  const { res, body } = await jsonFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const cookie = res.headers.getSetCookie?.()?.join("; ") ?? "";
  return { token: body.accessToken, cookie };
}

async function main() {
  const lines = [`# Phase XII1 UAT`, ``, `Base URL: ${baseUrl}`, `Date: ${new Date().toISOString()}`, ``];
  let pass = 0;
  let fail = 0;

  const health = await jsonFetch("/api/v1/health/ready");
  if (health.res.ok && health.body.checks?.database && health.body.checks?.redis) {
    lines.push(`- [x] Health ready (DB + Redis)`);
    pass += 1;
  } else {
    lines.push(`- [ ] Health ready — got ${health.res.status}`);
    fail += 1;
  }

  try {
    await login(adminEmail, adminPassword);
    lines.push(`- [x] Admin login`);
    pass += 1;
  } catch (e) {
    lines.push(`- [ ] Admin login — ${e.message}`);
    fail += 1;
  }

  lines.push(``);
  lines.push(`## Notes`);
  lines.push(`- Set \`PHASE_XII_ENABLED=true\` and run worker for async reward UAT.`);
  lines.push(`- Reward SLA target: **${rewardSlaSec}s** after order complete + paid.`);
  lines.push(`- Manual: complete a COD order → mark paid → verify wallet within SLA.`);

  lines.push(``);
  lines.push(`**Result:** ${fail === 0 ? "PASS (automated checks)" : `${pass} pass, ${fail} fail`}`);

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, lines.join("\n"));
  console.log(lines.join("\n"));
  console.log(`\nReport: ${reportPath}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
