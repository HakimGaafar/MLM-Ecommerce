/** Client-safe role helpers (no next/headers). */

export type AppRole = "ADMIN" | "VENDOR" | "CUSTOMER" | "AFFILIATE";

export function resolvePrimaryRole(roles: string[] = []): AppRole | null {
  if (roles.includes("ADMIN") || roles.includes("SUPER_ADMIN")) return "ADMIN";
  if (roles.includes("VENDOR")) return "VENDOR";
  if (roles.includes("CUSTOMER")) return "CUSTOMER";
  if (roles.includes("AFFILIATE")) return "AFFILIATE";
  return null;
}
