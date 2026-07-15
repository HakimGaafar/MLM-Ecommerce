/**
 * E2E smoke test: payment-first Stripe checkout keeps cart on abandon.
 * Run: node scripts/e2e-stripe-cart-survival.mjs
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? "mlm_session";
const prisma = new PrismaClient();

async function createAccessCookie(user) {
  const roles = user.userRoles.map((r) => r.role.code);
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    roles,
    tokenType: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  return `${AUTH_COOKIE}=${token}`;
}

function curl(args) {
  const result = spawnSync("curl.exe", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const line of setCookieHeaders.split(/\r?\n/)) {
    const part = line.split(";")[0]?.trim();
    if (!part || !part.includes("=")) continue;
    const idx = part.indexOf("=");
    jar[part.slice(0, idx)] = part.slice(idx + 1);
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function main() {
  const customer = await prisma.user.findFirst({
    where: {
      email: "test@example.com",
      status: "ACTIVE",
      userRoles: { some: { role: { code: "CUSTOMER" } } },
    },
    select: {
      id: true,
      email: true,
      userRoles: { select: { role: { select: { code: true } } } },
    },
  });
  if (!customer) {
    throw new Error("No CUSTOMER user found in DB.");
  }

  const market = await prisma.market.findFirst({ where: { code: "SA" }, select: { id: true } });
  if (!market) throw new Error("SA market not found.");

  const product = await prisma.product.findFirst({
    where: { status: "PUBLISHED", marketId: market.id },
    select: { id: true, name: true },
  });
  if (!product) throw new Error("No published SA product found.");

  const address = await prisma.customerShippingAddress.findFirst({
    where: { userId: customer.id, countryCode: "SA" },
    select: { id: true },
  });

  console.log(`Customer: ${customer.email}`);
  console.log(`Product: ${product.name} (${product.id})`);
  console.log(`Shipping address: ${address?.id ?? "NONE"}`);

  const cookieHeader = await createAccessCookie(customer);
  console.log("✓ Auth cookie minted for customer session");

  const cartBefore = curl([
    "-s",
    "-H",
    `Cookie: ${cookieHeader}`,
    `${BASE}/api/v1/customer/cart`,
  ]);
  let cart = JSON.parse(cartBefore.stdout);
  if (!cart.items?.length) {
    const addBody = join(tmpdir(), `mlm-e2e-add-${Date.now()}.json`);
    writeFileSync(addBody, JSON.stringify({ productId: product.id, quantity: 1 }));
    const add = curl([
      "-s",
      "-H",
      `Cookie: ${cookieHeader}`,
      "-X",
      "POST",
      `${BASE}/api/v1/customer/cart/items`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      `@${addBody}`,
    ]);
    unlinkSync(addBody);
    cart = JSON.parse(add.stdout);
  }
  const cartCountBefore = cart.items?.length ?? 0;
  const cartItemIds = (cart.items ?? []).map((i) => i.id);
  console.log(`✓ Cart has ${cartCountBefore} item(s)`);

  const ordersBefore = await prisma.order.count({
    where: { buyerUserId: customer.id, marketId: market.id },
  });

  const stripeBodyFile = join(tmpdir(), `mlm-e2e-stripe-${Date.now()}.json`);
  const stripePayload = {
    idempotencyKey: randomUUID(),
    useWalletBalance: false,
  };
  if (address?.id) stripePayload.shippingAddressId = address.id;
  writeFileSync(stripeBodyFile, JSON.stringify(stripePayload));

  const stripe = curl([
    "-s",
    "-w",
    "\n__HTTP__%{http_code}",
    "-H",
    `Cookie: ${cookieHeader}`,
    "-X",
    "POST",
    `${BASE}/api/v1/customer/checkout/stripe-session`,
    "-H",
    "Content-Type: application/json",
    "--data-binary",
    `@${stripeBodyFile}`,
  ]);
  unlinkSync(stripeBodyFile);

  const stripeParts = stripe.stdout.split("\n__HTTP__");
  const stripeBody = stripeParts[0] ?? "";
  const stripeStatus = stripeParts[1] ?? "";
  const stripeJson = JSON.parse(stripeBody);

  console.log(`Stripe session HTTP ${stripeStatus}`);
  console.log("Stripe response:", JSON.stringify(stripeJson, null, 2));

  if (stripeStatus !== "201") {
    throw new Error(`Expected 201 from stripe-session, got ${stripeStatus}: ${stripeBody}`);
  }
  if (stripeJson.orderId != null) {
    throw new Error(`Expected orderId=null before payment, got ${stripeJson.orderId}`);
  }
  if (!stripeJson.checkoutUrl) {
    throw new Error("Expected checkoutUrl from stripe-session");
  }
  console.log("✓ Stripe session opened without creating an order");

  const cartAfterStripe = JSON.parse(
    curl(["-s", "-H", `Cookie: ${cookieHeader}`, `${BASE}/api/v1/customer/cart`]).stdout,
  );
  const cartCountAfterStripe = cartAfterStripe.items?.length ?? 0;
  if (cartCountAfterStripe !== cartCountBefore) {
    throw new Error(
      `Cart item count changed after stripe-session: ${cartCountBefore} -> ${cartCountAfterStripe}`,
    );
  }
  console.log("✓ Cart unchanged after opening Stripe session");

  const ordersAfterStripe = await prisma.order.count({
    where: { buyerUserId: customer.id, marketId: market.id },
  });
  if (ordersAfterStripe !== ordersBefore) {
    throw new Error(
      `Order count changed after stripe-session: ${ordersBefore} -> ${ordersAfterStripe}`,
    );
  }
  console.log("✓ No new order row in database");

  const quoteAfterCancel = curl([
    "-s",
    "-H",
    `Cookie: ${cookieHeader}`,
    `${BASE}/api/v1/customer/checkout/quote`,
  ]);
  const quote = JSON.parse(quoteAfterCancel.stdout);
  if (!quote.cart?.items?.length) {
    throw new Error("Checkout quote cart empty after simulated Stripe abandon");
  }
  console.log("✓ Checkout quote still has cart items (simulated Back from Stripe)");

  const pendingCardOrders = await prisma.order.count({
    where: {
      buyerUserId: customer.id,
      paymentMethod: "ONLINE_CARD",
      paymentStatus: { in: ["PENDING", "FAILED"] },
      status: "CANCELLED",
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });
  console.log(`Recent cancelled card orders (last 5m): ${pendingCardOrders}`);

  console.log("\nPASS: payment-first flow keeps cart intact when Stripe is abandoned.");
}

main()
  .catch((e) => {
    console.error("\nFAIL:", e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
