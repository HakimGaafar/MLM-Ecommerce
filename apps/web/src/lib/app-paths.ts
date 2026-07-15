/** Marketing/auth/market-picker paths: no sidebar (shop/store keep sidebar when logged in). */
const PUBLIC_PREFIXES = ["/login", "/register", "/sell", "/market", "/contact"] as const;

export function isPublicAppPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function shouldShowAppSidebar(pathname: string, isLoggedIn: boolean): boolean {
  return isLoggedIn && !isPublicAppPath(pathname);
}
