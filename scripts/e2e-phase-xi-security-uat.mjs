/**
 * Phase XI security UAT — automated checks against running dev/staging server.
 *
 * Run: node scripts/e2e-phase-xi-security-uat.mjs
 * Env: E2E_BASE_URL (default http://localhost:3000), JWT_SECRET from .env
 *
 * Writes: scripts/reports/phase-xi-uat-report.json + .md
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? "mlm_session";
const prisma = new PrismaClient();

const ADMIN_ONLY_EMAIL = "xi-uat-admin-only@mlm.seed";
const ADMIN_ONLY_PASSWORD = "XiUatAdminOnly1!";

/** 1×1 PNG */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const MINIMAL_PDF = Buffer.from(
  `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj
xref
0 4
trailer<</Size 4/Root 1 0 R>>
startxref
100
%%EOF`,
  "utf8",
);

const results = [];
const startedAt = new Date().toISOString();

function record(id, name, status, details = {}) {
  const { status: _ignoredStatus, ...safeDetails } = details;
  results.push({
    id,
    name,
    status,
    at: new Date().toISOString(),
    ...safeDetails,
  });
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : status === "SKIP" ? "○" : "⚠";
  console.log(`${icon} #${id} ${name} — ${status}${safeDetails.note ? `: ${safeDetails.note}` : ""}`);
}

async function clearRateLimitsForUat() {
  try {
    const { getQueueRedis } = await import("@mlm/queue");
    const redis = getQueueRedis();
    const patterns = ["ratelimit:login:*", "ratelimit:register:*", "ratelimit:withdraw:*"];
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    }
  } catch {
    /* Redis optional in local dev — in-memory limits reset per process anyway */
  }
}

async function mintAccessCookie(user) {
  const roles = user.userRoles.map((r) => r.role.code);
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    roles,
    tokenType: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  return `${AUTH_COOKIE}=${token}`;
}

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = { ...(options.headers ?? {}) };
  const init = {
    method: options.method ?? "GET",
    headers,
    redirect: options.redirect ?? "manual",
  };
  if (options.body !== undefined) {
    init.body = options.body;
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    status: res.status,
    headers: res.headers,
    text,
    json,
    location: res.headers.get("location"),
  };
}

async function loadUser(email) {
  return prisma.user.findFirst({
    where: { email, status: "ACTIVE" },
    select: {
      id: true,
      email: true,
      userRoles: { select: { role: { select: { code: true } } } },
    },
  });
}

async function ensureAdminOnlyUser() {
  const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" } });
  if (!adminRole) throw new Error("ADMIN role missing — run db:seed");

  let user = await prisma.user.findUnique({ where: { email: ADMIN_ONLY_EMAIL } });
  if (!user) {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_ONLY_PASSWORD, 10);
    user = await prisma.user.create({
      data: {
        email: ADMIN_ONLY_EMAIL,
        name: "XI UAT Admin Only",
        passwordHash,
        status: "ACTIVE",
      },
    });
  }

  const superRow = await prisma.userRole.findFirst({
    where: { userId: user.id, role: { code: "SUPER_ADMIN" } },
  });
  if (superRow) {
    await prisma.userRole.delete({ where: { userId_roleId: { userId: user.id, roleId: superRow.roleId } } });
  }

  const adminRow = await prisma.userRole.findFirst({
    where: { userId: user.id, role: { code: "ADMIN" } },
  });
  if (!adminRow) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: adminRole.id },
    });
  }

  return loadUser(ADMIN_ONLY_EMAIL);
}

async function testLoginRateLimit() {
  const ip = "10.99.1.1";
  let saw429 = false;
  for (let i = 1; i <= 11; i++) {
    const res = await request("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({ email: "nobody@example.com", password: "WrongPass1!" }),
    });
    if (res.status === 429) {
      saw429 = true;
      record(1, "Login rate limit (11× wrong password → 429)", "PASS", {
        note: `429 on attempt ${i}`,
        attempt: i,
        retryAfter: res.headers.get("retry-after"),
      });
      return;
    }
  }
  record(1, "Login rate limit (11× wrong password → 429)", "FAIL", {
    note: "No 429 after 11 login attempts",
  });
}

async function testRegisterRateLimit() {
  const ip = "10.99.2.2";
  let saw429 = false;
  for (let i = 1; i <= 9; i++) {
    const res = await request("/api/v1/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({
        name: "Rate Test",
        email: `ratetest-${Date.now()}-${i}@example.com`,
        password: "RateTest1!xx",
      }),
    });
    if (res.status === 429) {
      saw429 = true;
      record(2, "Register rate limit (spam → 429)", "PASS", {
        note: `429 on attempt ${i}`,
        attempt: i,
      });
      return;
    }
  }
  if (!saw429) {
    record(2, "Register rate limit (spam → 429)", "FAIL", {
      note: "No 429 after 9 register attempts (limit is 8/15m)",
    });
  }
}

async function ensureWithdrawTestCustomer() {
  const bcrypt = await import("bcryptjs");
  const customerRole = await prisma.role.findUnique({ where: { code: "CUSTOMER" } });
  if (!customerRole) throw new Error("CUSTOMER role missing");

  const email = `xi-uat-withdraw-${Date.now()}@mlm.seed`;
  const passwordHash = await bcrypt.hash("XiUatWithdraw1!", 10);
  const market = await prisma.market.findFirst({ where: { code: "SA" }, select: { id: true } });
  if (!market) throw new Error("SA market missing");

  const user = await prisma.user.create({
    data: {
      email,
      name: "XI UAT Withdraw",
      passwordHash,
      status: "ACTIVE",
      userRoles: { create: { roleId: customerRole.id } },
      wallets: {
        create: {
          marketId: market.id,
          currency: "SAR",
        },
      },
    },
    select: {
      id: true,
      email: true,
      userRoles: { select: { role: { select: { code: true } } } },
    },
  });
  return user;
}

async function testWithdrawValidation(customerCookie) {
  const negative = await request("/api/v1/customer/wallet/withdraw", {
    method: "POST",
    headers: {
      Cookie: customerCookie,
      "Content-Type": "application/json",
      "X-Forwarded-For": "10.99.3.1",
    },
    body: JSON.stringify({ amount: -100 }),
  });
  const huge = await request("/api/v1/customer/wallet/withdraw", {
    method: "POST",
    headers: {
      Cookie: customerCookie,
      "Content-Type": "application/json",
      "X-Forwarded-For": "10.99.3.2",
    },
    body: JSON.stringify({ amount: 99_999_999 }),
  });
  const ok = negative.status === 400 && huge.status === 400;
  record(3, "Withdraw invalid amount → 400", ok ? "PASS" : "FAIL", {
    httpStatusNegative: negative.status,
    httpStatusHuge: huge.status,
    negativeError: negative.json?.error,
    hugeError: huge.json?.error,
  });
}

async function testWithdrawRateLimit(customerCookie) {
  const ip = "10.99.4.4";
  let saw429 = false;
  for (let i = 1; i <= 6; i++) {
    const res = await request("/api/v1/customer/wallet/withdraw", {
      method: "POST",
      headers: {
        Cookie: customerCookie,
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({ amount: 1 }),
    });
    if (res.status === 429) {
      saw429 = true;
      record(4, "Withdraw rate limit (6 in 15m → 429)", "PASS", {
        note: `429 on attempt ${i}`,
        attempt: i,
      });
      return;
    }
  }
  record(4, "Withdraw rate limit (6 in 15m → 429)", "FAIL", {
    note: "No 429 after 6 withdraw attempts",
  });
}

async function uploadKyc(cookie, fileBuffer, fileName, mimeType) {
  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: mimeType }), fileName);
  form.append("documentType", "NATIONAL_ID");
  return request("/api/v1/customer/kyc", {
    method: "POST",
    headers: {
      Cookie: cookie,
      "X-Forwarded-For": `10.99.5.${Math.floor(Math.random() * 200)}`,
    },
    body: form,
  });
}

async function testKycUploads(customerCookie) {
  const fake = await uploadKyc(
    customerCookie,
    Buffer.from("not a real image", "utf8"),
    "fake.jpg",
    "image/jpeg",
  );
  const fakeOk = fake.status === 400;
  record(
    5,
    "KYC fake file (PDF/text as JPEG) → rejected",
    fakeOk ? "PASS" : "FAIL",
    { httpStatus: fake.status, error: fake.json?.error },
  );

  const valid = await uploadKyc(customerCookie, MINIMAL_PDF, "valid-id.pdf", "application/pdf");
  const validOk = valid.status === 201 || valid.status === 409;
  record(6, "Valid KYC PDF → accepted (201 or 409 if already uploaded)", validOk ? "PASS" : "FAIL", {
    httpStatus: valid.status,
    error: valid.json?.error,
  });
}

async function testProductUpload(vendorCookie) {
  const formBad = new FormData();
  formBad.append("file", new Blob([Buffer.from("not-image", "utf8")], { type: "image/jpeg" }), "bad.jpg");
  const bad = await request("/api/v1/vendor/products/upload", {
    method: "POST",
    headers: { Cookie: vendorCookie },
    body: formBad,
  });
  record(7, "Product fake image → rejected", bad.status === 400 ? "PASS" : "FAIL", {
    httpStatus: bad.status,
    error: bad.json?.error,
  });
}

async function testAdminValidation(adminCookie) {
  const withdrawal = await request("/api/v1/admin/withdrawals/nonexistent-id", {
    method: "PATCH",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "not-a-real-action" }),
  });
  record(8, "Admin withdrawal invalid action → 400", withdrawal.status === 400 ? "PASS" : "FAIL", {
    httpStatus: withdrawal.status,
    error: withdrawal.json?.error,
  });

  const settlement = await request("/api/v1/admin/settlements/release", {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transactionIds: [] }),
  });
  record(9, "Settlement release empty ids → 400", settlement.status === 400 ? "PASS" : "FAIL", {
    httpStatus: settlement.status,
    error: settlement.json?.error,
  });

  const kycId = "clxiuat000000000000000000";
  const kyc = await request(`/api/v1/admin/kyc/documents/${kycId}`, {
    method: "PATCH",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "reject" }),
  });
  record(10, "KYC reject without reason → 400", kyc.status === 400 ? "PASS" : "FAIL", {
    httpStatus: kyc.status,
    error: kyc.json?.error,
    usedDocumentId: kycId,
  });
}

async function testAdminBoundaries(adminOnlyCookie, superAdminCookie) {
  const settingsBlocked = await request("/api/v1/admin/settings?marketCode=SA", {
    headers: { Cookie: adminOnlyCookie },
  });
  const marketsBlocked = await request("/api/v1/admin/markets", {
    headers: { Cookie: adminOnlyCookie },
  });
  const settingsOk = await request("/api/v1/admin/settings?marketCode=SA", {
    headers: { Cookie: superAdminCookie },
  });
  const marketsOk = await request("/api/v1/admin/markets", {
    headers: { Cookie: superAdminCookie },
  });

  const pageSettings = await request("/admin/settings", {
    headers: { Cookie: adminOnlyCookie },
  });
  const pageRedirected =
    pageSettings.status === 307 ||
    pageSettings.status === 302 ||
    pageSettings.location?.includes("/admin");

  const pass11 =
    settingsBlocked.status === 403 &&
    marketsBlocked.status === 403 &&
    (pageSettings.status === 307 || pageSettings.status === 302 || pageRedirected);
  record(11, "ADMIN-only blocked from settings + markets API/pages", pass11 ? "PASS" : "FAIL", {
    settingsStatus: settingsBlocked.status,
    marketsStatus: marketsBlocked.status,
    pageStatus: pageSettings.status,
    pageLocation: pageSettings.location,
  });

  const pass12 = settingsOk.status === 200 && marketsOk.status === 200;
  record(12, "SUPER_ADMIN can access settings + markets", pass12 ? "PASS" : "FAIL", {
    settingsStatus: settingsOk.status,
    marketsStatus: marketsOk.status,
  });
}

async function testSecurityHeaders() {
  const res = await request("/", { redirect: "follow" });
  const csp = res.headers.get("content-security-policy");
  const cspRo = res.headers.get("content-security-policy-report-only");
  const hsts = res.headers.get("strict-transport-security");

  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    record(13, "Production CSP enforced (not report-only)", csp && !cspRo ? "PASS" : "FAIL", {
      csp: csp?.slice(0, 120),
      reportOnly: Boolean(cspRo),
    });
    record(14, "Production HSTS header", hsts ? "PASS" : "FAIL", { hsts });
  } else {
    record(13, "CSP header present (dev: report-only expected)", cspRo || csp ? "PASS" : "WARN", {
      note: "Dev uses report-only; verify production separately",
      cspReportOnly: Boolean(cspRo),
      cspEnforced: Boolean(csp),
      sample: (cspRo ?? csp)?.slice(0, 100),
    });
    record(14, "HSTS (production only)", "SKIP", {
      note: "HSTS only set when NODE_ENV=production — verify on staging/prod deploy",
      hsts,
    });
  }
}

async function testAuthCookies() {
  const res = await request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@mlm.seed",
      password: "SeedDemo123!",
    }),
  });
  const raw = res.headers.getSetCookie?.() ?? [];
  const setCookie = raw.length ? raw : [res.headers.get("set-cookie")].filter(Boolean);
  const sessionLine = setCookie.find((c) => c?.startsWith(`${AUTH_COOKIE}=`));
  const refreshLine = setCookie.find((c) => c?.startsWith("mlm_refresh="));

  const check = (line, label) => {
    if (!line) return { label, ok: false, flags: "missing" };
    const lower = line.toLowerCase();
    const httpOnly = lower.includes("httponly");
    const sameSite = lower.includes("samesite=lax") || lower.includes("samesite=strict");
    const secure = lower.includes("secure") || process.env.NODE_ENV !== "production";
    return {
      label,
      ok: httpOnly && sameSite && secure,
      httpOnly,
      sameSite,
      secure: lower.includes("secure"),
      secureSkippedInDev: process.env.NODE_ENV !== "production",
    };
  };

  const session = check(sessionLine, AUTH_COOKIE);
  const refresh = check(refreshLine, "mlm_refresh");
  const pass = session.ok && refresh.ok && res.status === 200;
  record(15, "Auth cookies HttpOnly + SameSite (+ Secure in prod)", pass ? "PASS" : "FAIL", {
    loginStatus: res.status,
    session,
    refresh,
  });
}

async function testStripeSession(customerCookie) {
  const res = await request("/api/v1/customer/checkout/stripe-session", {
    method: "POST",
    headers: {
      Cookie: customerCookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idempotencyKey: `xi-uat-${Date.now()}`,
      useWalletBalance: false,
    }),
  });
  const url = res.json?.checkoutUrl ?? "";
  const pass =
    (res.status === 201 && url.includes("stripe.com")) ||
    (res.status === 400 && /cart|address|shipping/i.test(res.json?.error ?? ""));
  record(16, "Stripe checkout API reachable (CSP/connect-src smoke)", pass ? "PASS" : "WARN", {
    httpStatus: res.status,
    checkoutUrl: url ? `${url.slice(0, 60)}…` : null,
    error: res.json?.error,
    note:
      res.status === 400
        ? "Cart/address prerequisite missing — API path OK; confirm card UI in browser"
        : undefined,
  });
}

async function testRegression(customerCookie, vendorCookie, adminCookie) {
  const cart = await request("/api/v1/customer/cart", { headers: { Cookie: customerCookie } });
  const products = await request("/api/v1/vendor/products", { headers: { Cookie: vendorCookie } });
  const orders = await request("/api/v1/admin/orders?page=1&pageSize=5", {
    headers: { Cookie: adminCookie },
  });
  const pass = cart.status === 200 && products.status === 200 && orders.status === 200;
  record(17, "Regression: cart, vendor products, admin orders", pass ? "PASS" : "FAIL", {
    cart: cart.status,
    vendorProducts: products.status,
    adminOrders: orders.status,
  });
}

function buildReport() {
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const automated = results.filter((r) => r.status !== "SKIP").length;
  const signOffReady = fail === 0;

  return {
    phase: "XI",
    title: "Security hardening UAT",
    baseUrl: BASE,
    startedAt,
    finishedAt: new Date().toISOString(),
    summary: { total: results.length, pass, fail, skip, warn, automated, signOffReady },
    results,
  };
}

function writeReports(report) {
  const dir = join(__dirname, "reports");
  mkdirSync(dir, { recursive: true });
  const jsonPath = join(dir, "phase-xi-uat-report.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const lines = [
    `# Phase XI Security UAT Report`,
    ``,
    `**Base URL:** ${report.baseUrl}`,
    `**Run at:** ${report.finishedAt}`,
    `**Summary:** ${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.warn} warn, ${report.summary.skip} skip (${report.summary.total} checks)`,
  ];
  if (report.summary.signOffReady) {
    lines.push(`**Sign-off:** Ready for \`Green light Phase XI\` (automated checks)`);
  } else {
    lines.push(`**Sign-off:** Not ready — fix ${report.summary.fail} failure(s)`);
  }
  lines.push(``, `| # | Check | Status | Details |`, `|---|-------|--------|---------|`);
  for (const r of report.results) {
    const detail =
      r.note ??
      r.error ??
      (r.status !== "PASS" && r.status !== "SKIP"
        ? JSON.stringify(
            Object.fromEntries(
              Object.entries(r).filter(
                ([k]) => !["id", "name", "status", "at", "note"].includes(k),
              ),
            ),
          ).slice(0, 120)
        : "—");
    lines.push(`| ${r.id} | ${r.name} | **${r.status}** | ${String(detail).replace(/\|/g, "\\|")} |`);
  }
  lines.push(
    ``,
    `## Manual follow-ups (not fully automatable)`,
    ``,
    `| Item | Action |`,
    `|------|--------|`,
    `| Stripe card form in browser | Open checkout URL from a real cart + address; confirm Stripe iframe loads under CSP |`,
    `| Production CSP/HSTS | Re-run against staging/prod URL or \`NODE_ENV=production\` build |`,
    `| Redis rate limits | Confirm \`REDIS_URL\` set in staging so limits are shared across pods |`,
    ``,
    `*Generated by \`scripts/e2e-phase-xi-security-uat.mjs\`*`,
  );

  const mdPath = join(dir, "phase-xi-uat-report.md");
  writeFileSync(mdPath, lines.join("\n"));
  return { jsonPath, mdPath };
}

async function main() {
  console.log(`Phase XI UAT — ${BASE}\n`);

  const health = await request("/api/v1/public/health").catch(() => null);
  if (!health || (health.status !== 200 && health.status !== 404)) {
    const root = await request("/");
    if (root.status >= 500) {
      throw new Error(`Server not reachable at ${BASE} (status ${root.status})`);
    }
  }

  const customer = await loadUser("test@example.com");
  const superAdmin = await loadUser("admin@mlm.seed");
  const vendor = await loadUser("demo.vendor@mlm.seed");
  if (!customer || !superAdmin || !vendor) {
    throw new Error("Missing seed users — run npm run db:seed");
  }

  const adminOnly = await ensureAdminOnlyUser();
  const customerCookie = await mintAccessCookie(customer);
  const superAdminCookie = await mintAccessCookie(superAdmin);
  const vendorCookie = await mintAccessCookie(vendor);
  const adminOnlyCookie = await mintAccessCookie(adminOnly);

  await clearRateLimitsForUat();

  const withdrawCustomer = await ensureWithdrawTestCustomer();
  const withdrawCookie = await mintAccessCookie(withdrawCustomer);

  await testLoginRateLimit();
  await testRegisterRateLimit();
  await testWithdrawValidation(withdrawCookie);
  await testWithdrawRateLimit(withdrawCookie);
  await testKycUploads(customerCookie);
  await testProductUpload(vendorCookie);
  await testAdminValidation(superAdminCookie);
  await testAdminBoundaries(adminOnlyCookie, superAdminCookie);
  await testSecurityHeaders();
  await testAuthCookies();
  await testStripeSession(customerCookie);
  await testRegression(customerCookie, vendorCookie, superAdminCookie);

  const allPass = results.every((r) => r.status === "PASS" || r.status === "SKIP" || r.status === "WARN");
  record(18, "Phase XI automated gate → ready for Phase XII", allPass ? "PASS" : "FAIL", {
    note: allPass
      ? "All automated checks passed or skipped/warned"
      : "One or more checks failed",
  });

  const report = buildReport();
  const paths = writeReports(report);

  console.log(`\n---`);
  console.log(`Report: ${paths.mdPath}`);
  console.log(`JSON:   ${paths.jsonPath}`);
  console.log(
    `Result: ${report.summary.pass} pass / ${report.summary.fail} fail / ${report.summary.warn} warn / ${report.summary.skip} skip`,
  );

  if (report.summary.fail > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error("\nFATAL:", e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
