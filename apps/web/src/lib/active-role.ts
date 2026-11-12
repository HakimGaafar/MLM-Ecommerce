import type { AppRole } from "@/lib/app-role";
import { resolvePrimaryRole } from "@/lib/app-role";

export const ACTIVE_ROLE_COOKIE = "mlm_active_role";

const ROLE_ORDER: AppRole[] = ["ADMIN", "VENDOR", "CUSTOMER", "AFFILIATE"];

export function getRolesUserCanSwitch(roles: string[] = []): AppRole[] {
  return ROLE_ORDER.filter((r) => {
    if (r === "AFFILIATE") return false;
    if (r === "ADMIN") return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
    return roles.includes(r);
  });
}

export function resolveActiveRole(
  roles: string[] = [],
  cookieValue?: string | null,
): AppRole | null {
  const available = getRolesUserCanSwitch(roles);
  if (available.length === 0) return resolvePrimaryRole(roles);

  if (cookieValue && available.includes(cookieValue as AppRole)) {
    return cookieValue as AppRole;
  }

  return resolvePrimaryRole(roles);
}

/** Portal home for the active role (Phase 3: vendor ≠ customer). Safe for client + server. */
export function homePathForActiveRole(role: AppRole | null | undefined): string {
  if (role === "ADMIN") return "/admin";
  if (role === "VENDOR") return "/vendor";
  if (role === "CUSTOMER" || role === "AFFILIATE") return "/dashboard";
  return "/account/customer";
}

export function activeRoleCookieOptions(secure = process.env.NODE_ENV === "production") {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    secure,
    httpOnly: true,
  };
}

export function clearActiveRoleCookie(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
) {
  response.cookies.set(ACTIVE_ROLE_COOKIE, "", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    expires: new Date(0),
  });
}
