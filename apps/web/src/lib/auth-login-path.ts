/** Login landing pages after session expiry or a protected-page hit. */

export function loginPathForRequestPath(pathname: string): string {
  const path = pathname.split("?")[0] || "/";
  if (
    path.startsWith("/vendor") ||
    path.startsWith("/sell") ||
    path.startsWith("/account/merchant") ||
    path.startsWith("/api/v1/vendor")
  ) {
    return "/account/merchant";
  }
  if (path.startsWith("/account/marketer") || path.startsWith("/affiliate")) {
    return "/account/marketer";
  }
  return "/account/customer";
}

export function loginPathForRequiredRole(role: "ADMIN" | "VENDOR" | "CUSTOMER" | "AFFILIATE"): string {
  if (role === "VENDOR") return "/account/merchant";
  if (role === "AFFILIATE") return "/account/marketer";
  return "/account/customer";
}

export function isAuthLandingPath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  return (
    path.startsWith("/account/") ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password")
  );
}
