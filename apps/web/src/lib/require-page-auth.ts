import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/server-session";
import { getServerSession } from "@/lib/server-session";

export function homePathForRoles(roles: string[] = []): string {
  if (roles.includes("ADMIN")) return "/admin";
  if (roles.includes("VENDOR")) return "/vendor";
  if (roles.includes("CUSTOMER")) return "/dashboard";
  return "/login";
}

/** Server component guard — redirects to /login or the user's home dashboard. */
export async function requirePageAuth(requiredRole: AppRole) {
  const session = await getServerSession();
  if (!session?.sub) {
    redirect("/login");
  }
  const roles = session.roles ?? [];
  if (!roles.includes(requiredRole)) {
    redirect(homePathForRoles(roles));
  }
  return session;
}
