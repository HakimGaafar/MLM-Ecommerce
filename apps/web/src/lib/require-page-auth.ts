import { redirect } from "next/navigation";
import { homePathForActiveRole, resolveActiveRole } from "@/lib/active-role";
import { loginPathForRequiredRole } from "@/lib/auth-login-path";
import type { AppRole } from "@/lib/app-role";
import { resolvePrimaryRole } from "@/lib/app-role";
import { getServerSession } from "@/lib/server-session";

/** Fallback home from JWT roles when no active-role cookie is available. */
export function homePathForRoles(roles: string[] = []): string {
  return homePathForActiveRole(resolvePrimaryRole(roles));
}

export { homePathForActiveRole, resolveActiveRole };

/** Server component guard — redirects to the matching login or the user's home dashboard. */
export async function requirePageAuth(requiredRole: AppRole) {
  const session = await getServerSession();
  if (!session?.sub) {
    redirect(loginPathForRequiredRole(requiredRole));
  }
  const roles = session.roles ?? [];
  const hasRequiredRole =
    roles.includes(requiredRole) ||
    (requiredRole === "ADMIN" && roles.includes("SUPER_ADMIN"));
  if (!hasRequiredRole) {
    redirect(homePathForRoles(roles));
  }
  return session;
}
