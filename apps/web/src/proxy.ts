import { handleMarketRouting, shouldRunMarketRouting } from "@/lib/market-routing";
import { resolveMarketIdFromRequestCookies } from "@/lib/market-request-cookies";
import { getPermissionsForVendorActor, resolveVendorAccessForUser } from "@mlm/domain";
import { canAccessVendorPath, firstAllowedVendorNavHref } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";

const REFERRAL_COOKIE = "mlm_referral_code";

const routeRoleMap: Array<{ prefix: string; role: string }> = [
  { prefix: "/api/v1/admin", role: "ADMIN" },
  { prefix: "/api/v1/vendor", role: "VENDOR" },
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/vendor", role: "VENDOR" },
  { prefix: "/customer", role: "CUSTOMER" },
];

function dashboardFromRoles(roles: string[] = []) {
  if (roles.includes("ADMIN") || roles.includes("SUPER_ADMIN")) return "/admin";
  if (roles.includes("VENDOR")) return "/vendor";
  if (roles.includes("CUSTOMER")) return "/customer";
  return "/";
}

function hasRouteRole(roles: string[] = [], requiredRole: string) {
  if (roles.includes(requiredRole)) return true;
  if (requiredRole === "ADMIN" && roles.includes("SUPER_ADMIN")) return true;
  return false;
}

function attachReferralCookie(
  response: NextResponse,
  isRegisterPage: boolean,
  referralCode?: string,
) {
  if (!isRegisterPage || !referralCode) return response;
  response.cookies.set(REFERRAL_COOKIE, referralCode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

function redirectToHttps(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return null;
  const proto = request.headers.get("x-forwarded-proto");
  if (proto === "https") return null;
  if (!proto && request.nextUrl.protocol === "https:") return null;
  if (proto !== "http" && request.nextUrl.protocol !== "http:") return null;
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  return NextResponse.redirect(url, 308);
}

export async function proxy(request: NextRequest) {
  const httpsRedirect = redirectToHttps(request);
  if (httpsRedirect) return httpsRedirect;

  const pathname = request.nextUrl.pathname;

  if (shouldRunMarketRouting(pathname)) {
    const marketResult = await handleMarketRouting(request, () => NextResponse.next());
    if (marketResult) {
      const isApiRouteEarly = pathname.startsWith("/api/");
      if (isApiRouteEarly && marketResult.status >= 300 && marketResult.status < 400) {
        return marketResult;
      }
      if (!isApiRouteEarly) {
        const isLoginPageEarly = pathname.startsWith("/login");
        const isRegisterPageEarly = pathname.startsWith("/register");
        const referralFromQueryEarly = request.nextUrl.searchParams.get("ref");
        const normalizedReferralEarly = referralFromQueryEarly?.trim().toUpperCase();
        const hasValidReferralInQueryEarly = Boolean(
          normalizedReferralEarly && /^[A-Z0-9]{4,24}$/.test(normalizedReferralEarly),
        );
        return attachReferralCookie(
          marketResult,
          isRegisterPageEarly,
          hasValidReferralInQueryEarly ? normalizedReferralEarly : undefined,
        );
      }
    }
  }

  const isApiRoute = pathname.startsWith("/api/");
  const isCleanProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/returns") ||
    pathname.startsWith("/cashback") ||
    pathname.startsWith("/affiliate") ||
    pathname.startsWith("/kyc") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout");
  const cleanPath = pathname.startsWith("/customer/profile")
    ? "/profile"
    : pathname.startsWith("/customer/orders")
      ? `/orders${pathname.slice("/customer/orders".length)}`
      : pathname.startsWith("/customer/cart")
        ? `/cart${pathname.slice("/customer/cart".length)}`
        : pathname.startsWith("/customer/checkout")
          ? `/checkout${pathname.slice("/customer/checkout".length)}`
        : pathname.startsWith("/customer")
          ? "/dashboard"
          : pathname === "/vendor" || pathname === "/vendor/"
            ? "/dashboard"
            : pathname === "/admin" || pathname === "/admin/"
              ? "/dashboard"
            : null;
  const matched = routeRoleMap.find((item) =>
    pathname.startsWith(item.prefix),
  );
  const isLoginPage = pathname.startsWith("/login");
  const isRegisterPage = pathname.startsWith("/register");
  const referralFromQuery = request.nextUrl.searchParams.get("ref");
  const normalizedReferral = referralFromQuery?.trim().toUpperCase();
  const hasValidReferralInQuery = Boolean(
    normalizedReferral && /^[A-Z0-9]{4,24}$/.test(normalizedReferral),
  );

  const token = getAccessTokenFromRequest(request);
  const session = token ? await verifyAccessToken(token).catch(() => null) : null;
  const activeMarketId = resolveMarketIdFromRequestCookies(request);

  if ((isLoginPage || isRegisterPage) && session) {
    return attachReferralCookie(
      NextResponse.redirect(new URL("/dashboard", request.url)),
      isRegisterPage,
      hasValidReferralInQuery ? normalizedReferral : undefined,
    );
  }

  if (!matched && !isCleanProtectedPage) {
    return attachReferralCookie(
      NextResponse.next(),
      isRegisterPage,
      hasValidReferralInQuery ? normalizedReferral : undefined,
    );
  }

  if (!session) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (cleanPath && !isApiRoute) {
    const destination = new URL(cleanPath, request.url);
    destination.search = request.nextUrl.search;
    return attachReferralCookie(
      NextResponse.redirect(destination),
      isRegisterPage,
      hasValidReferralInQuery ? normalizedReferral : undefined,
    );
  }

  if (!matched && isCleanProtectedPage) {
    if (
      session?.roles?.includes("VENDOR") &&
      (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))
    ) {
      const access = await resolveVendorAccessForUser(session.sub, activeMarketId);
      if (!access) {
        return NextResponse.redirect(new URL("/sell", request.url));
      }
      const perms = await getPermissionsForVendorActor(access.vendorId, session.sub);
      if (!canAccessVendorPath(perms, pathname)) {
        const fallback = firstAllowedVendorNavHref(perms) ?? "/sell";
        return NextResponse.redirect(new URL(fallback, request.url));
      }
    }
    return attachReferralCookie(
      NextResponse.next(),
      isRegisterPage,
      hasValidReferralInQuery ? normalizedReferral : undefined,
    );
  }

  const hasRole = hasRouteRole(session?.roles, matched!.role);

  if (!hasRole) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(dashboardFromRoles(session.roles), request.url));
  }

  if (session?.roles?.includes("VENDOR") && !isApiRoute) {
    const access = await resolveVendorAccessForUser(session.sub, activeMarketId);
    if (!access && !pathname.startsWith("/sell")) {
      return NextResponse.redirect(new URL("/sell", request.url));
    }
    if (access) {
      const perms = await getPermissionsForVendorActor(access.vendorId, session.sub);
      if (!canAccessVendorPath(perms, pathname)) {
        const fallback = firstAllowedVendorNavHref(perms) ?? "/sell";
        return NextResponse.redirect(new URL(fallback, request.url));
      }
    }
  }

  return attachReferralCookie(
    NextResponse.next(),
    isRegisterPage,
    hasValidReferralInQuery ? normalizedReferral : undefined,
  );
}

export const config = {
  matcher: [
    "/",
    "/market",
    "/market-unavailable",
    "/products/:path*",
    "/stores/:path*",
    "/sell/:path*",
    "/api/v1/admin/:path*",
    "/api/v1/vendor/:path*",
    "/api/v1/customer/:path*",
    "/api/v1/catalog/:path*",
    "/api/v1/public/:path*",
    "/admin",
    "/admin/:path*",
    "/vendor",
    "/vendor/:path*",
    "/customer",
    "/customer/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/profile/:path*",
    "/orders/:path*",
    "/returns/:path*",
    "/cashback/:path*",
    "/affiliate/:path*",
    "/kyc",
    "/kyc/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/login",
    "/register",
  ],
};
