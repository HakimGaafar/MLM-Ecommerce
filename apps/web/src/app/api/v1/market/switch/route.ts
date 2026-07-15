import {
  buildMarketOrigin,
  ACTIVE_MARKET_COOKIE,
  definitionToSnapshot,
  isApexOrWwwHost,
  resolveMarketCodeFromHost,
} from "@/lib/market-context";
import { isMarketCodeActive } from "@/lib/market-server";
import {
  getMarketDefinition,
  isMarketCode,
  resolveMarketFromGeoCountry,
  type MarketCode,
} from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SwitchSchema = z.object({
  marketCode: z.enum(["SA", "OM", "EG", "GLOBAL"]),
});

function cookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function marketRedirectUrl(request: NextRequest, code: MarketCode): string {
  const def = getMarketDefinition(code);
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim();
  const origin = buildMarketOrigin({
    market: definitionToSnapshot(def),
    protocol: request.nextUrl.protocol,
    rootDomain,
    fallbackHost: host,
  });
  const path = request.nextUrl.searchParams.get("returnTo")?.trim() || "/";
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return `${origin}${safePath}`;
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = SwitchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const code = parsed.data.marketCode;
  if (!(await isMarketCodeActive(code))) {
    return NextResponse.json({ error: "Market is not available" }, { status: 403 });
  }
  const redirectUrl = marketRedirectUrl(request, code);
  const res = NextResponse.json({ ok: true, redirectUrl, marketCode: code });
  res.cookies.set(ACTIVE_MARKET_COOKIE, code, cookieOptions());
  return res;
}

export async function GET(request: NextRequest) {
  const geoHeader = process.env.GEO_IP_HEADER?.trim() || "cf-ipcountry";
  const country =
    request.headers.get(geoHeader) ?? request.headers.get("x-vercel-ip-country");
  const suggested = resolveMarketFromGeoCountry(country);
  const host = request.headers.get("host") ?? "";
  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim();
  const fromHost = resolveMarketCodeFromHost(host, rootDomain);
  const cookieCode = request.cookies.get(ACTIVE_MARKET_COOKIE)?.value;
  const active =
    fromHost ??
    (cookieCode && isMarketCode(cookieCode) ? cookieCode : null) ??
    suggested;

  return NextResponse.json({
    suggested,
    active,
    isApex: isApexOrWwwHost(host, rootDomain),
  });
}
