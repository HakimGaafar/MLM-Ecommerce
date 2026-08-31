import { prisma, raceSafeUpsert } from "@mlm/db";
import { DEFAULT_MARKET_ID, type MarketCode } from "@mlm/shared";
import { listAllCustomerShippingAddressesForCheckout } from "./customer-addresses.service";
import { pickShippingAddressForMarket } from "./delivery-market";
import { getCustomerProfile } from "./profile.service";
import {
  computeServiceAreaWarnings,
  type CartDeliveryIssueDto,
} from "../shipping/product-service-area.service";

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
  deliveryAddress: { city: string; countryCode: string } | null;
  deliveryIssues: CartDeliveryIssueDto[];
};

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

async function resolveCartDeliveryAddress(
  userId: string,
  marketId: string,
  activeMarketCode: MarketCode,
): Promise<{ city: string; countryCode: string } | null> {
  const addresses = await listAllCustomerShippingAddressesForCheckout(userId);
  const pick = pickShippingAddressForMarket({
    addresses,
    activeMarketCode,
  });
  if (pick.selectedAddressId) {
    const addr = addresses.find((row) => row.id === pick.selectedAddressId);
    if (addr?.city?.trim() && addr.countryCode?.trim()) {
      return { city: addr.city.trim(), countryCode: addr.countryCode.trim().toUpperCase() };
    }
  }

  const profile = await getCustomerProfile(userId);
  const city = profile?.shippingCity?.trim() || profile?.city?.trim();
  const countryCode =
    profile?.shippingCountryCode?.trim().toUpperCase() ||
    profile?.countryCode?.trim().toUpperCase();
  if (city && countryCode) {
    return { city, countryCode };
  }

  return null;
}

async function buildCartDeliveryIssues(params: {
  userId: string;
  marketId: string;
  activeMarketCode: MarketCode;
  lines: Array<{
    itemId: string;
    productId: string;
    productName: string;
    vendorId: string;
    stockLocation?: string;
  }>;
}): Promise<{
  deliveryAddress: { city: string; countryCode: string } | null;
  deliveryIssues: CartDeliveryIssueDto[];
}> {
  const deliveryAddress = await resolveCartDeliveryAddress(
    params.userId,
    params.marketId,
    params.activeMarketCode,
  );
  if (!deliveryAddress) {
    return { deliveryAddress: null, deliveryIssues: [] };
  }

  const warnings = await computeServiceAreaWarnings({
    lines: params.lines,
    countryCode: deliveryAddress.countryCode,
    city: deliveryAddress.city,
  });

  const itemIdByProduct = new Map<string, string>();
  for (const line of params.lines) {
    itemIdByProduct.set(line.productId, line.itemId);
  }

  const deliveryIssues: CartDeliveryIssueDto[] = warnings
    .map((warning) => {
      const itemId = warning.itemId ?? itemIdByProduct.get(warning.productId);
      if (!itemId) return null;
      return { ...warning, itemId };
    })
    .filter((row): row is CartDeliveryIssueDto => row !== null);

  return { deliveryAddress, deliveryIssues };
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

export async function getCustomerCartItemCount(userId: string, marketId: string): Promise<number> {
  const cart = await prisma.cart.findUnique({
    where: { userId_marketId: { userId, marketId } },
    select: { _count: { select: { items: true } } },
  });
  return cart?._count.items ?? 0;
}

export async function getCustomerCart(
  userId: string,
  marketId: string,
  defaultCurrency = "SAR",
): Promise<CustomerCartDto> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { code: true },
  });
  const activeMarketCode = (market?.code ?? "SA") as MarketCode;

  const cart = await prisma.cart.findUnique({
    where: { userId_marketId: { userId, marketId } },
    select: { id: true },
  });

  if (!cart) {
    return {
      items: [],
      subtotal: "0.00",
      currency: defaultCurrency,
      deliveryAddress: null,
      deliveryIssues: [],
    };
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
          vendorId: true,
          vendor: { select: { storeName: true } },
          marketOffers: {
            where: { marketId },
            take: 1,
            select: { price: true, currency: true, stockLocation: true },
          },
        },
      },
    },
  });

  const items: CustomerCartLineDto[] = [];
  const issueLines: Array<{
    itemId: string;
    productId: string;
    productName: string;
    vendorId: string;
    stockLocation?: string;
  }> = [];
  let subtotal = 0;
  let currency = defaultCurrency;

  for (const row of rows) {
    const p = row.product;
    if (!p || p.status !== "PUBLISHED") continue;
    const offer = p.marketOffers[0];
    const unitPrice = offer?.price ?? p.price;
    const lineCurrency = offer?.currency ?? p.currency;
    currency = lineCurrency || "SAR";
    const unit = Number(unitPrice);
    const line = unit * row.quantity;
    subtotal += line;
    items.push({
      itemId: row.id,
      productId: p.id,
      name: p.name,
      vendorName: p.vendor.storeName,
      unitPrice: unitPrice.toString(),
      currency: lineCurrency,
      quantity: row.quantity,
      lineTotal: round2(line),
    });
    issueLines.push({
      itemId: row.id,
      productId: p.id,
      productName: p.name,
      vendorId: p.vendorId,
      stockLocation: offer?.stockLocation,
    });
  }

  const { deliveryAddress, deliveryIssues } = await buildCartDeliveryIssues({
    userId,
    marketId,
    activeMarketCode,
    lines: issueLines,
  });

  return {
    items,
    subtotal: round2(subtotal),
    currency,
    deliveryAddress,
    deliveryIssues,
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
    where: {
      id: productId,
      status: "PUBLISHED",
      vendor: { storeApprovalStatus: "APPROVED" },
      OR: [
        { marketOffers: { some: { marketId } } },
        { marketId, marketOffers: { none: {} } },
      ],
    },
    select: {
      id: true,
      vendorId: true,
      marketOffers: {
        where: { marketId },
        take: 1,
        select: { stockLocation: true },
      },
    },
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
