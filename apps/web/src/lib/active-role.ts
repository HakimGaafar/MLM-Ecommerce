import type { AppRole } from "@/lib/server-session";
import { resolvePrimaryRole } from "@/lib/server-session";

export const ACTIVE_ROLE_COOKIE = "mlm_active_role";

const ROLE_ORDER: AppRole[] = ["ADMIN", "VENDOR", "CUSTOMER", "AFFILIATE"];

export function getRolesUserCanSwitch(roles: string[] = []): AppRole[] {
  return ROLE_ORDER.filter((r) => roles.includes(r) && r !== "AFFILIATE");
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
