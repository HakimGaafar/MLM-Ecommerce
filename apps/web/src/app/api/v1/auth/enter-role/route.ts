import {
  ACTIVE_ROLE_COOKIE,
  activeRoleCookieOptions,
  getRolesUserCanSwitch,
  homePathForActiveRole,
} from "@/lib/active-role";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ROLES = new Set(["ADMIN", "VENDOR", "CUSTOMER"]);

type SwitchableRole = "ADMIN" | "VENDOR" | "CUSTOMER";

function resolveRoleAndDestination(
  roles: string[],
  roleParam: string,
  toParam: string,
): { role: SwitchableRole | null; destination: string } {
  const allowed = getRolesUserCanSwitch(roles);
  const role =
    ALLOWED_ROLES.has(roleParam) && allowed.includes(roleParam as SwitchableRole)
      ? (roleParam as SwitchableRole)
      : null;
  const fallback = homePathForActiveRole(role ?? allowed[0] ?? null);
  const destination =
    toParam.startsWith("/") && !toParam.startsWith("//") ? toParam : fallback;
  return { role, destination };
}

/** True for first-party navigations; false for cross-site CSRF via top-level GET. */
function isFirstPartyNavigation(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  if (fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none") {
    return true;
  }
  // Older clients without Sec-Fetch-Site: require Origin match when present.
  return isSameOriginRequest(request);
}

/**
 * Set active role (must own it). Preferred for SPA / fetch callers.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request, { requireOrigin: true })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = getAccessTokenFromRequest(request);
  const session = token ? await verifyAccessToken(token).catch(() => null) : null;
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const roleParam = String(body?.role ?? request.nextUrl.searchParams.get("role") ?? "")
    .trim()
    .toUpperCase();
  const toParam = String(body?.to ?? request.nextUrl.searchParams.get("to") ?? "").trim();

  const { role, destination } = resolveRoleAndDestination(
    session.roles ?? [],
    roleParam,
    toParam,
  );

  const res = NextResponse.json({ ok: true, role, redirectTo: destination });
  if (role) {
    res.cookies.set(ACTIVE_ROLE_COOKIE, role, activeRoleCookieOptions());
  }
  return res;
}

/**
 * First-party redirect helper (e.g. marketer → affiliate).
 * Cookie mutation is refused for cross-site navigations (CSRF).
 */
export async function GET(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  const session = token ? await verifyAccessToken(token).catch(() => null) : null;
  if (!session?.sub) {
    return NextResponse.redirect(new URL("/account/customer", request.url));
  }

  const roleParam = (request.nextUrl.searchParams.get("role") ?? "").toUpperCase();
  const toParam = request.nextUrl.searchParams.get("to") ?? "";
  const { role, destination } = resolveRoleAndDestination(
    session.roles ?? [],
    roleParam,
    toParam,
  );

  const res = NextResponse.redirect(new URL(destination, request.url));
  if (role && isFirstPartyNavigation(request)) {
    res.cookies.set(ACTIVE_ROLE_COOKIE, role, activeRoleCookieOptions());
  }
  return res;
}
