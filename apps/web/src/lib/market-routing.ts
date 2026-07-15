import {
  ACTIVE_MARKET_COOKIE,
  isApexOrWwwHost,
  MARKET_REQUEST_HEADER,
  resolveMarketCodeFromHost,
} from "@/lib/market-context";
import { isMarketCodeActive } from "@/lib/market-server";
import {
  DEFAULT_MARKET_CODE,
  isMarketCode,
  resolveMarketFromGeoCountry,
  type MarketCode,
} from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";

const MARKET_QUERY_PARAM = "market";

function cookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function attachMarketHeader(response: NextResponse, code: MarketCode) {
  response.headers.set(MARKET_REQUEST_HEADER, code);
  return response;
}

function withMarketCookie(response: NextResponse, code: MarketCode) {
  response.cookies.set(ACTIVE_MARKET_COOKIE, code, cookieOptions());
  return attachMarketHeader(response, code);
}

function resolveActiveMarketCode(request: NextRequest): MarketCode {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim();

  const fromHost = resolveMarketCodeFromHost(host, rootDomain);
  if (fromHost) return fromHost;

  const fromCookie = request.cookies.get(ACTIVE_MARKET_COOKIE)?.value;
  if (fromCookie && isMarketCode(fromCookie)) return fromCookie;

  const fromQuery = request.nextUrl.searchParams.get(MARKET_QUERY_PARAM);
  if (fromQuery && isMarketCode(fromQuery.toUpperCase())) {
    return fromQuery.toUpperCase() as MarketCode;
  }

  const geoHeader = process.env.GEO_IP_HEADER?.trim() || "cf-ipcountry";
  const country =
    request.headers.get(geoHeader) ??
    request.headers.get("x-vercel-ip-country") ??
    readDevGeoCountryOverride();
  return resolveMarketFromGeoCountry(country);
}

/** Local dev: simulate geo when Cloudflare/Vercel headers are absent (localhost). */
function readDevGeoCountryOverride(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const cc = process.env.DEV_GEO_COUNTRY?.trim().toUpperCase();
  return cc && cc.length === 2 ? cc : null;
}

export async function handleMarketRouting(
  request: NextRequest,
  responseFactory: () => NextResponse,
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/)
  ) {
    return null;
  }

  const host = request.headers.get("host") ?? request.nextUrl.host;
  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim();
  const queryMarket = request.nextUrl.searchParams.get(MARKET_QUERY_PARAM)?.toUpperCase();

  if (queryMarket && isMarketCode(queryMarket)) {
    if (!(await isMarketCodeActive(queryMarket))) {
      if (pathname !== "/market-unavailable") {
        const url = request.nextUrl.clone();
        url.pathname = "/market-unavailable";
        url.searchParams.delete(MARKET_QUERY_PARAM);
        url.searchParams.set("market", queryMarket);
        return NextResponse.redirect(url);
      }
    } else {
      const url = request.nextUrl.clone();
      url.searchParams.delete(MARKET_QUERY_PARAM);
      const redirect = NextResponse.redirect(url);
      return withMarketCookie(redirect, queryMarket);
    }
  }

  const fromHost = resolveMarketCodeFromHost(host, rootDomain);
  if (fromHost && !(await isMarketCodeActive(fromHost))) {
    if (pathname !== "/market-unavailable") {
      const url = request.nextUrl.clone();
      url.pathname = "/market-unavailable";
      url.searchParams.set("market", fromHost);
      return NextResponse.redirect(url);
    }
    const res = responseFactory();
    return attachMarketHeader(res, DEFAULT_MARKET_CODE);
  }

  let activeCode = resolveActiveMarketCode(request);
  if (!(await isMarketCodeActive(activeCode))) {
    activeCode = DEFAULT_MARKET_CODE;
  }
  const cookieCode = request.cookies.get(ACTIVE_MARKET_COOKIE)?.value;

  if (pathname === "/market") {
    const res = responseFactory();
    if (!cookieCode || cookieCode !== activeCode) {
      return withMarketCookie(res, activeCode);
    }
    return attachMarketHeader(res, activeCode);
  }

  const fromHostAfter = resolveMarketCodeFromHost(host, rootDomain);
  if (fromHostAfter) {
    const res = responseFactory();
    if (cookieCode !== fromHostAfter) {
      return withMarketCookie(res, fromHostAfter);
    }
    return attachMarketHeader(res, fromHostAfter);
  }

  if (isApexOrWwwHost(host, rootDomain) && !cookieCode && pathname === "/") {
    let suggested = resolveMarketFromGeoCountry(
      request.headers.get(process.env.GEO_IP_HEADER?.trim() || "cf-ipcountry") ??
        request.headers.get("x-vercel-ip-country") ??
        readDevGeoCountryOverride(),
    );
    if (!(await isMarketCodeActive(suggested))) {
      suggested = DEFAULT_MARKET_CODE;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/market";
    url.searchParams.set("suggested", suggested);
    return NextResponse.redirect(url);
  }

  const res = responseFactory();
  if (!cookieCode) {
    return withMarketCookie(res, activeCode);
  }
  if (cookieCode !== activeCode && !fromHostAfter) {
    return withMarketCookie(res, activeCode);
  }
  return attachMarketHeader(res, cookieCode as MarketCode);
}

export function shouldRunMarketRouting(pathname: string): boolean {
  if (pathname.startsWith("/api/v1/market")) return false;
  return true;
}
