import { prisma, raceSafeUpsert } from "@mlm/db";
import { DEFAULT_MARKET_ID } from "@mlm/shared";

export type CustomerCartLineDto = {
  itemId: string;
  productId: string;
  name: string;
  vendorName: string;
  unitPrice: string;
  currency: string;
  quantity: number;
  lineTotal: string;
};

export type CustomerCartDto = {
  items: CustomerCartLineDto[];
  subtotal: string;
  currency: string;
};

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

async function ensureCart(userId: string, marketId: string = DEFAULT_MARKET_ID) {
  const where = { userId_marketId: { userId, marketId } };
  return raceSafeUpsert({
    upsert: () =>
      prisma.cart.upsert({
        where,
        create: { userId, marketId },
        update: {},
      }),
    findUnique: () => prisma.cart.findUnique({ where }),
  });
}

export async function getCustomerCart(
  userId: string,
  marketId: string,
  defaultCurrency = "SAR",
): Promise<CustomerCartDto> {
  const cart = await prisma.cart.findUnique({
    where: { userId_marketId: { userId, marketId } },
    select: { id: true },
  });

  if (!cart) {
    return { items: [], subtotal: "0.00", currency: defaultCurrency };
  }

  await prisma.cartItem.deleteMany({
    where: {
      cartId: cart.id,
      product: { status: { not: "PUBLISHED" } },
    },
  });

  const rows = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { updatedAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          status: true,
          vendor: { select: { storeName: true } },
        },
      },
    },
  });

  const items: CustomerCartLineDto[] = [];
  let subtotal = 0;
  let currency = defaultCurrency;

  for (const row of rows) {
    const p = row.product;
    if (!p || p.status !== "PUBLISHED") continue;
    currency = p.currency || "SAR";
    const unit = Number(p.price);
    const line = unit * row.quantity;
    subtotal += line;
    items.push({
      itemId: row.id,
      productId: p.id,
      name: p.name,
      vendorName: p.vendor.storeName,
      unitPrice: p.price.toString(),
      currency: p.currency,
      quantity: row.quantity,
      lineTotal: round2(line),
    });
  }

  return {
    items,
    subtotal: round2(subtotal),
    currency,
  };
}

export async function addCartItem(
  userId: string,
  productId: string,
  quantity: number,
  marketId: string,
  defaultCurrency = "SAR",
): Promise<CustomerCartDto> {
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "PUBLISHED", marketId },
    select: { id: true },
  });
  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const cart = await ensureCart(userId, marketId);
  const cartItemWhere = { cartId_productId: { cartId: cart.id, productId } };

  await raceSafeUpsert({
    upsert: () =>
      prisma.cartItem.upsert({
        where: cartItemWhere,
        create: {
          cartId: cart.id,
          productId,
          quantity,
        },
        update: {
          quantity: { increment: quantity },
        },
      }),
    findUnique: () => prisma.cartItem.findUnique({ where: cartItemWhere }),
  });

  const merged = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
    select: { quantity: true },
  });
  if (merged && merged.quantity > 99) {
    await prisma.cartItem.update({
      where: { cartId_productId: { cartId: cart.id, productId } },
      data: { quantity: 99 },
    });
  }

  return getCustomerCart(userId, marketId, defaultCurrency);
}

export async function updateCartItemQuantity(
  userId: string,
  itemId: string,
  quantity: number,
  marketId: string,
  defaultCurrency = "SAR",
): Promise<CustomerCartDto> {
  const cart = await prisma.cart.findUnique({
    where: { userId_marketId: { userId, marketId } },
    select: { id: true },
  });
  if (!cart) {
    throw new Error("CART_NOT_FOUND");
  }

  const row = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    select: { id: true },
  });
  if (!row) {
    throw new Error("ITEM_NOT_FOUND");
  }

  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
  });

  return getCustomerCart(userId, marketId, defaultCurrency);
}

export async function removeCartItem(
  userId: string,
  itemId: string,
  marketId: string,
  defaultCurrency = "SAR",
): Promise<CustomerCartDto> {
  const cart = await prisma.cart.findUnique({
    where: { userId_marketId: { userId, marketId } },
    select: { id: true },
  });
  if (!cart) {
    return getCustomerCart(userId, marketId, defaultCurrency);
  }

  await prisma.cartItem.deleteMany({
    where: { id: itemId, cartId: cart.id },
  });

  return getCustomerCart(userId, marketId, defaultCurrency);
}
