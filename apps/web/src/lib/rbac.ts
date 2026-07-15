import { hasCapability } from "@mlm/domain";
import type { RoleCode } from "@mlm/shared";

export function requireCapability(roles: RoleCode[], capability: string): boolean {
  return hasCapability(roles, capability);
}

export function hasRole(roles: RoleCode[], role: RoleCode): boolean {
  return roles.includes(role);
}
