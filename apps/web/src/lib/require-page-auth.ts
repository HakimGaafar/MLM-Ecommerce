import { redirect } from "next/navigation";
import { loginPathForRequiredRole } from "@/lib/auth-login-path";
import type { AppRole } from "@/lib/server-session";
import { getServerSession } from "@/lib/server-session";

export function homePathForRoles(roles: string[] = []): string {
  if (roles.includes("ADMIN") || roles.includes("SUPER_ADMIN")) return "/admin";
  if (roles.includes("VENDOR")) return "/vendor";
  if (roles.includes("CUSTOMER")) return "/dashboard";
  return "/account/customer";
}

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
