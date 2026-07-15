export const RESERVED_STORE_SLUGS = new Set([
  "admin",
  "api",
  "login",
  "register",
  "sell",
  "seller",
  "stores",
  "store",
  "vendor",
  "customer",
  "products",
  "product",
  "cart",
  "checkout",
  "dashboard",
  "profile",
  "orders",
  "returns",
  "cashback",
  "static",
  "assets",
  "www",
]);

export function slugifyStoreName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function isReservedStoreSlug(slug: string): boolean {
  return RESERVED_STORE_SLUGS.has(slug);
}
