import { resolveDefaultVendorMarketCode } from "@mlm/domain";
import {
  buildMarketOrigin,
  ACTIVE_MARKET_COOKIE,
  definitionToSnapshot,
} from "@/lib/market-context";
import { isMarketCodeActive } from "@/lib/market-server";
import {
  DEFAULT_MARKET_CODE,
  getMarketDefinition,
  isMarketCode,
  type MarketCode,
} from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";

function cookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function safeReturnPath(value: string | null | undefined): string {
  const path = value?.trim() || "/";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function marketRedirectUrl(request: NextRequest, code: MarketCode, returnTo: string): string {
  const def = getMarketDefinition(code);
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim();
  const origin = buildMarketOrigin({
    market: definitionToSnapshot(def),
    protocol: request.nextUrl.protocol,
    rootDomain,
    fallbackHost: host,
  });
  return `${origin}${returnTo}`;
}

async function resolveMarketForSession(
  userId: string,
  roles: string[],
): Promise<MarketCode | null> {
  if (roles.includes("ADMIN")) {
    return DEFAULT_MARKET_CODE;
  }

  if (roles.includes("VENDOR")) {
    return resolveDefaultVendorMarketCode(userId);
  }

  return null;
}

async function handleAutoResolve(request: NextRequest, returnTo: string, asRedirect: boolean) {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    if (asRedirect) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifyAccessToken(token).catch(() => null);
  if (!session?.sub) {
    if (asRedirect) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.roles ?? [];
  const marketCode = await resolveMarketForSession(session.sub, roles);
  if (!marketCode || !isMarketCode(marketCode)) {
    if (asRedirect) {
      return NextResponse.redirect(new URL("/market", request.url));
    }
    return NextResponse.json({ error: "No auto market for this account" }, { status: 400 });
  }

  if (!(await isMarketCodeActive(marketCode))) {
    if (asRedirect) {
      return NextResponse.redirect(new URL("/market", request.url));
    }
    return NextResponse.json({ error: "Market is not available" }, { status: 403 });
  }

  const redirectUrl = marketRedirectUrl(request, marketCode, returnTo);
  if (asRedirect) {
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set(ACTIVE_MARKET_COOKIE, marketCode, cookieOptions());
    return res;
  }

  const res = NextResponse.json({
    ok: true,
    marketCode,
    redirectUrl,
    skipPicker: true,
  });
  res.cookies.set(ACTIVE_MARKET_COOKIE, marketCode, cookieOptions());
  return res;
}

/** Sets marketplace cookie for admins (default SA) or vendors (first store market A–Z). */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get("returnTo"));
  return handleAutoResolve(request, returnTo, true);
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const returnTo = safeReturnPath(
    typeof raw === "object" && raw && "returnTo" in raw
      ? String((raw as { returnTo?: string }).returnTo ?? "")
      : request.nextUrl.searchParams.get("returnTo"),
  );
  return handleAutoResolve(request, returnTo, false);
}
