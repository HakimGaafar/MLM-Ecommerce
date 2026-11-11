import { promises as dns } from "node:dns";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@mlm/db";
import {
  getMarketHostCheckTokens,
  isMarketCodeFormat,
  MARKET_HOST_CHECK_PATH,
} from "@mlm/shared";

export type HostDnsVerifyResult = {
  ok: boolean;
  hostname: string;
  checkedAt: string;
  method: "A_OVERLAP" | "AAAA_OVERLAP" | "CNAME" | "HOST_TOKEN" | "NONE";
  detail: string;
  records: {
    a: string[];
    aaaa: string[];
    cname: string[];
    expectedA: string[];
    expectedAaaa: string[];
    expectedCnames: string[];
  };
};

function rootDomain(): string | null {
  const root = process.env.APP_ROOT_DOMAIN?.trim().toLowerCase();
  return root || null;
}

function expectedCnameTargets(root: string): string[] {
  const fromEnv = (process.env.MARKET_HOST_EXPECTED_CNAMES ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
  const defaults = [root, `www.${root}`, `apex.${root}`];
  return [...new Set([...fromEnv, ...defaults])];
}

async function lookupA(hostname: string): Promise<string[]> {
  try {
    return await dns.resolve4(hostname);
  } catch {
    return [];
  }
}

async function lookupAaaa(hostname: string): Promise<string[]> {
  try {
    return await dns.resolve6(hostname);
  } catch {
    return [];
  }
}

async function lookupCname(hostname: string): Promise<string[]> {
  try {
    const rows = await dns.resolveCname(hostname);
    return rows.map((r) => r.replace(/\.$/, "").toLowerCase());
  } catch {
    return [];
  }
}

function overlap(a: string[], b: string[]): boolean {
  const setB = new Set(b);
  return a.some((x) => setB.has(x));
}

/**
 * Live DNS check: `{subdomain}.{APP_ROOT_DOMAIN}` must resolve in a way that
 * matches the apex/www (or MARKET_HOST_EXPECTED_CNAMES), or prove our app via
 * `/.well-known/vandsoq-host-check` token (CDN-friendly).
 */
export async function verifyMarketHostDns(params: {
  marketCode: string;
  /** When true, persist result on the market row. */
  persist?: boolean;
}): Promise<HostDnsVerifyResult> {
  const code = params.marketCode.trim().toUpperCase();
  if (!isMarketCodeFormat(code)) {
    return emptyFail("", "Invalid market code.");
  }

  const market = await prisma.market.findUnique({
    where: { code },
    select: { id: true, subdomain: true },
  });
  if (!market?.subdomain) {
    return emptyFail("", "Market has no subdomain.");
  }

  const root = rootDomain();
  if (!root) {
    return emptyFail(
      market.subdomain,
      "APP_ROOT_DOMAIN is not set — cannot verify DNS for market subdomains.",
    );
  }

  const hostname = `${market.subdomain}.${root}`.toLowerCase();
  const expectedHosts = expectedCnameTargets(root);

  const [a, aaaa, cname, expectedA, expectedAaaa] = await Promise.all([
    lookupA(hostname),
    lookupAaaa(hostname),
    lookupCname(hostname),
    lookupA(root).then(async (apex) => {
      const www = await lookupA(`www.${root}`);
      return [...new Set([...apex, ...www])];
    }),
    lookupAaaa(root).then(async (apex) => {
      const www = await lookupAaaa(`www.${root}`);
      return [...new Set([...apex, ...www])];
    }),
  ]);

  const records = {
    a,
    aaaa,
    cname,
    expectedA,
    expectedAaaa,
    expectedCnames: expectedHosts,
  };

  let result: HostDnsVerifyResult;

  if (cname.some((c) => expectedHosts.includes(c) || expectedHosts.some((e) => c.endsWith(`.${e}`)))) {
    result = {
      ok: true,
      hostname,
      checkedAt: new Date().toISOString(),
      method: "CNAME",
      detail: `CNAME for ${hostname} points at platform target (${cname.join(", ")}).`,
      records,
    };
  } else if (a.length > 0 && expectedA.length > 0 && overlap(a, expectedA)) {
    result = {
      ok: true,
      hostname,
      checkedAt: new Date().toISOString(),
      method: "A_OVERLAP",
      detail: `A records for ${hostname} overlap apex/www (${a.join(", ")}).`,
      records,
    };
  } else if (aaaa.length > 0 && expectedAaaa.length > 0 && overlap(aaaa, expectedAaaa)) {
    result = {
      ok: true,
      hostname,
      checkedAt: new Date().toISOString(),
      method: "AAAA_OVERLAP",
      detail: `AAAA records for ${hostname} overlap apex/www.`,
      records,
    };
  } else {
    // Token path — proves *our* app answers this host (CDN-friendly).
    const tokenProbe = await probeHostCheckToken(hostname);
    if (tokenProbe.ok) {
      result = {
        ok: true,
        hostname,
        checkedAt: new Date().toISOString(),
        method: "HOST_TOKEN",
        detail: tokenProbe.detail,
        records,
      };
    } else {
      result = {
        ok: false,
        hostname,
        checkedAt: new Date().toISOString(),
        method: "NONE",
        detail:
          `DNS for ${hostname} does not match platform apex/www yet. ` +
          `Got A=[${a.join(",") || "none"}] CNAME=[${cname.join(",") || "none"}]. ` +
          `Expected overlap with apex A=[${expectedA.join(",") || "none"}] or CNAME in [${expectedHosts.join(", ")}]. ` +
          tokenProbe.detail,
        records,
      };
    }
  }

  if (params.persist !== false && market.id) {
    await prisma.market.update({
      where: { id: market.id },
      data: {
        hostRoutingConfirmed: result.ok,
        hostRoutingConfirmedAt: result.ok ? new Date() : null,
      },
    });
  }

  return result;
}

function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  try {
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/**
 * Probes `/.well-known/vandsoq-host-check` on the market host.
 * Passes when response token matches MARKET_HOST_CHECK_TOKEN
 * or MARKET_HOST_CHECK_TOKEN_PREV (rotate window).
 */
async function probeHostCheckToken(
  hostname: string,
): Promise<{ ok: boolean; detail: string }> {
  const expected = getMarketHostCheckTokens();
  if (expected.length === 0) {
    return {
      ok: false,
      detail:
        "Host token probe skipped: set MARKET_HOST_CHECK_TOKEN so the platform can prove the host serves this app.",
    };
  }

  const proto = process.env.MARKET_HOST_HTTP_PROBE_PROTO?.trim() || "https";
  const url = `${proto}://${hostname}${MARKET_HOST_CHECK_PATH}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        ok: false,
        detail: `Host token probe HTTP ${res.status} for ${url}.`,
      };
    }

    const headerToken = res.headers.get("x-vandsoq-host-check")?.trim() ?? "";
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; token?: string; service?: string }
      | null;
    const bodyToken = typeof body?.token === "string" ? body.token.trim() : "";
    const got = headerToken || bodyToken;

    if (!got || !expected.some((token) => tokensEqual(got, token))) {
      return {
        ok: false,
        detail: `Host token mismatch at ${url} — host did not return MARKET_HOST_CHECK_TOKEN.`,
      };
    }

    return {
      ok: true,
      detail: `Host token check passed at ${url} (our app answered).`,
    };
  } catch (e) {
    return {
      ok: false,
      detail: `Host token probe failed for ${url}: ${e instanceof Error ? e.message : "error"}`,
    };
  }
}

function emptyFail(hostname: string, detail: string): HostDnsVerifyResult {
  return {
    ok: false,
    hostname,
    checkedAt: new Date().toISOString(),
    method: "NONE",
    detail,
    records: { a: [], aaaa: [], cname: [], expectedA: [], expectedAaaa: [], expectedCnames: [] },
  };
}
