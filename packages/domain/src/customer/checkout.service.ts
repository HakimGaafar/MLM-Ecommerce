import { randomUUID } from "node:crypto";
import type { CustomerProfileDto, CustomerShippingAddressDto, ProductFulfillmentTypeCode } from "@mlm/shared";
import { previewCheckoutTotalsFromSubtotalString } from "@mlm/shared";
import {
  getPlatformConfig,
  getVatRate,
} from "../platform-config/platform-config.service";
import { Prisma, prisma } from "@mlm/db";
import { buildUnitRowsForOrder } from "../orders/order-units.service";
import {
  resolveShippingForCheckout,
  shippingBreakdownToDto,
  sumVendorShippingFees,
  type CheckoutShippingBreakdownDto,
} from "../shipping/shipping-checkout.service";
import type { CustomerCartDto } from "./cart.service";
import { getCustomerCart } from "./cart.service";
import {
  buildOrderShippingFromSavedAddress,
  getCustomerShippingAddressForBuyer,
  getDefaultShippingAddressId,
  listAllCustomerShippingAddressesForCheckout,
} from "./customer-addresses.service";
import { getCustomerProfile } from "./profile.service";
import { getCustomerOrderForBuyer } from "./orders.service";
import {
  assertProfileReadyForCheckout as assertShippingProfileReady,
  buildShippingSnapshotFromProfile,
  isSavedShippingAddressComplete,
  ShippingProfileError,
} from "./shipping-profile";
import {
  CouponCheckoutError,
  incrementCouponUsedCounts,
  resolveCouponsForCheckout,
  type CartLineForCoupon,
  type CouponsCheckoutResolution,
} from "./coupon-checkout.service";
import { assertShippingCountryMatchesMarket, pickShippingAddressForMarket } from "./delivery-market";
import type { MarketCode } from "@mlm/shared";

export class CheckoutError extends Error {
  constructor(
    public readonly code:
      | "EMPTY_CART"
      | "MIXED_CURRENCY"
      | "INCOMPLETE_SHIPPING_PROFILE"
      | "UNSUPPORTED_PAYMENT_METHOD"
      | "INVALID_SHIPPING_ADDRESS"
      | "INVALID_COUPON"
      | "COUPON_USAGE_EXCEEDED"
      | "COUPON_VENDOR_MISMATCH"
      | "COUPON_CURRENCY_MISMATCH"
      | "INSUFFICIENT_WALLET_BALANCE"
      | "DELIVERY_MARKET_MISMATCH",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "CheckoutError";
  }
}

export type PlaceOrderInput = {
  paymentMethod?: "COD" | "ONLINE_CARD";
  idempotencyKey?: string | null;
  shippingAddressId?: string | null;
  couponCode?: string | null;
  couponCodes?: string[] | null;
  useWalletBalance?: boolean;
};

export type CheckoutQuoteCouponApplicationDto = {
  couponId: string;
  vendorId: string;
  vendorName: string;
  discountType: CouponsCheckoutResolution["applications"][number]["discountType"];
  discountValue: string;
  discountAmount: string;
};

export type CheckoutQuoteCouponCodeDto = {
  code: string;
  applications: CheckoutQuoteCouponApplicationDto[];
  discountTotal: string;
};

export type CheckoutQuoteCouponsDto = {
  codes: CheckoutQuoteCouponCodeDto[];
  discountTotal: string;
};

export type { CheckoutShippingBreakdownDto };

type PreparedCartLine = CartLineForCoupon & {
  cartItemId: string;
  productId: string;
  name: string;
  vendorName: string;
  fulfillmentType: ProductFulfillmentTypeCode;
  quantity: number;
  unitPrice: Prisma.Decimal;
};

function mapCouponCheckoutError(error: CouponCheckoutError): CheckoutError {
  return new CheckoutError(error.code, error.message);
}

function assertProfileReadyForCheckout(profile: CustomerProfileDto | null): asserts profile is CustomerProfileDto {
  try {
    assertShippingProfileReady(profile);
  } catch (e) {
    if (e instanceof ShippingProfileError) {
      throw new CheckoutError("INCOMPLETE_SHIPPING_PROFILE", e.message);
    }
    throw e;
  }
}

/** Checkout is allowed when there is a valid saved delivery address or a complete legacy profile. */
async function isCheckoutShippingReady(
  buyerUserId: string,
  profile: CustomerProfileDto | null,
): Promise<boolean> {
  const addresses = await listAllCustomerShippingAddressesForCheckout(buyerUserId);
  if (addresses.some(isSavedShippingAddressComplete)) {
    return true;
  }
  try {
    assertProfileReadyForCheckout(profile);
    return true;
  } catch {
    return false;
  }
}

function buildShippingSnapshot(profile: CustomerProfileDto, recipientName: string) {
  return buildShippingSnapshotFromProfile(profile, recipientName);
}

function buildOrderNo() {
  return `ORD-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

async function loadPreparedCartLines(
  buyerUserId: string,
  marketId: string,
  db: Prisma.TransactionClient | typeof prisma,
): Promise<PreparedCartLine[]> {
  const cart = await db.cart.findUnique({
    where: { userId_marketId: { userId: buyerUserId, marketId } },
    select: { id: true },
  });
  if (!cart) return [];

  await db.cartItem.deleteMany({
    where: { cartId: cart.id, product: { status: { not: "PUBLISHED" } } },
  });

  const rows = await db.cartItem.findMany({
    where: { cartId: cart.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          status: true,
          vendorId: true,
          fulfillmentType: true,
          vendor: { select: { storeName: true } },
        },
      },
    },
  });

  const prepared: PreparedCartLine[] = [];
  for (const row of rows) {
    const p = row.product;
    if (!p || p.status !== "PUBLISHED") continue;
    const unitPrice = new Prisma.Decimal(p.price.toString());
    prepared.push({
      cartItemId: row.id,
      productId: p.id,
      vendorId: p.vendorId,
      name: p.name,
      vendorName: p.vendor.storeName,
      fulfillmentType: p.fulfillmentType as ProductFulfillmentTypeCode,
      quantity: row.quantity,
      unitPrice,
      lineTotal: unitPrice.mul(row.quantity),
      currency: p.currency || "SAR",
    });
  }
  return prepared;
}

function assertSingleCurrency(prepared: PreparedCartLine[]): void {
  if (prepared.length === 0) throw new CheckoutError("EMPTY_CART");
  const firstCurrency = prepared[0].currency;
  if (prepared.some((line) => line.currency !== firstCurrency)) {
    throw new CheckoutError("MIXED_CURRENCY", "Cart contains multiple currencies");
  }
}

function computeOrderTotals(
  subtotal: Prisma.Decimal,
  discountTotal: Prisma.Decimal,
  shippingFee: Prisma.Decimal,
  vatRate: number,
) {
  const taxable = subtotal.add(shippingFee).sub(discountTotal);
  const vatRaw = Number(taxable.mul(new Prisma.Decimal(vatRate)));
  const vatTotal = new Prisma.Decimal((Math.round(vatRaw * 100) / 100).toFixed(2));
  const totalAmount = subtotal.add(shippingFee).add(vatTotal).sub(discountTotal);
  return { shippingFee, vatTotal, totalAmount };
}

async function resolveOptionalCoupons(
  couponCode: string | null | undefined,
  prepared: PreparedCartLine[],
  db: Prisma.TransactionClient | typeof prisma,
): Promise<CouponsCheckoutResolution | null> {
  const trimmed = couponCode?.trim();
  if (!trimmed) return null;
  try {
    return await resolveCouponsForCheckout(trimmed, prepared, db);
  } catch (e) {
    if (e instanceof CouponCheckoutError) throw mapCouponCheckoutError(e);
    throw e;
  }
}

async function resolveOptionalCouponCodes(
  couponCodes: string[] | null | undefined,
  prepared: PreparedCartLine[],
  db: Prisma.TransactionClient | typeof prisma,
): Promise<{
  codes: CheckoutQuoteCouponCodeDto[];
  applications: CouponsCheckoutResolution["applications"];
  discountTotal: Prisma.Decimal;
} | null> {
  const codes = (couponCodes ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
    // Avoid double-consuming same coupon code.
    .filter((c, idx, arr) => arr.indexOf(c) === idx);

  if (codes.length === 0) return null;

  let overallDiscount = new Prisma.Decimal(0);
  const codesDto: CheckoutQuoteCouponCodeDto[] = [];
  const flattenedApps: CouponsCheckoutResolution["applications"] = [];

  for (const code of codes) {
    let resolved: CouponsCheckoutResolution;
    try {
      resolved = await resolveCouponsForCheckout(code, prepared, db);
    } catch (e) {
      if (e instanceof CouponCheckoutError) throw mapCouponCheckoutError(e);
      throw e;
    }
    if (resolved.applications.length === 0) continue;

    overallDiscount = overallDiscount.add(resolved.discountTotal);
    flattenedApps.push(...resolved.applications);
    codesDto.push({
      code: resolved.code,
      discountTotal: resolved.discountTotal.toFixed(2),
      applications: resolved.applications.map((app) => ({
        couponId: app.couponId,
        vendorId: app.vendorId,
        vendorName: app.vendorName,
        discountType: app.discountType,
        discountValue: app.discountValue,
        discountAmount: app.discountTotal.toFixed(2),
      })),
    });
  }

  if (flattenedApps.length === 0) return null;

  return {
    codes: codesDto,
    applications: flattenedApps,
    discountTotal: overallDiscount,
  };
}

export function isOnlineCardCheckoutEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export async function getCheckoutQuoteForUser(
  buyerUserId: string,
  marketId: string,
  options: {
    couponCode?: string | null;
    couponCodes?: string[] | null;
    useWalletBalance?: boolean;
    shippingAddressId?: string | null;
  } = {},
): Promise<{
  cart: CustomerCartDto;
  shippingFee: string;
  shippingBreakdown: CheckoutShippingBreakdownDto[];
  discountTotal: string;
  vatTotal: string;
  totalAmount: string;
  profileComplete: boolean;
  shippingAddresses: CustomerShippingAddressDto[];
  defaultShippingAddressId: string | null;
  suggestedShippingAddressId: string | null;
  shippingCountryCode: string | null;
  activeMarketCode: string;
  deliveryMismatchMarketCode: string | null;
  coupons: CheckoutQuoteCouponsDto | null;
  cardPaymentsEnabled: boolean;
  plannedPaymentGateways: {
    tap: boolean;
    hyperpay: boolean;
    myfatoorah: boolean;
  };
  walletAvailableBalance: string;
  walletAppliedAmount: string;
  remainingAmount: string;
}> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { defaultCurrency: true, code: true },
  });
  const defaultCurrency = market?.defaultCurrency ?? "SAR";
  const activeMarketCode = (market?.code ?? "SA") as MarketCode;

  const cart = await getCustomerCart(buyerUserId, marketId, defaultCurrency);
  const profile = await getCustomerProfile(buyerUserId);
  const shippingAddresses = await listAllCustomerShippingAddressesForCheckout(buyerUserId);
  const defaultShippingAddressId = await getDefaultShippingAddressId(buyerUserId);
  const profileComplete = await isCheckoutShippingReady(buyerUserId, profile);

  const addressPick = pickShippingAddressForMarket({
    addresses: shippingAddresses,
    activeMarketCode,
    requestedAddressId: options.shippingAddressId,
    profileCountryCode: profile?.countryCode ?? null,
  });

  const prepared = await loadPreparedCartLines(buyerUserId, marketId, prisma);
  let discountTotal = "0";
  let couponsDto: CheckoutQuoteCouponsDto | null = null;
  let shippingBreakdown: CheckoutShippingBreakdownDto[] = [];
  let shippingFeeTotal = "0";

  if (prepared.length > 0) {
    assertSingleCurrency(prepared);
    const couponCodes = options.couponCodes ?? (options.couponCode ? [options.couponCode] : undefined);
    const coupons = await resolveOptionalCouponCodes(couponCodes, prepared, prisma);
    if (coupons) {
      discountTotal = coupons.discountTotal.toFixed(2);
      couponsDto = { codes: coupons.codes, discountTotal };
    }
    const shippingLines = await resolveShippingForCheckout(
      prepared.map((line) => ({ vendorId: line.vendorId, fulfillmentType: line.fulfillmentType })),
      prisma,
    );
    shippingBreakdown = shippingBreakdownToDto(shippingLines);
    shippingFeeTotal = sumVendorShippingFees(shippingLines).toFixed(2);
  }

  const platformConfig = await getPlatformConfig(marketId);
  const vatRate = platformConfig.vatRate;
  const totals = previewCheckoutTotalsFromSubtotalString(
    cart.subtotal,
    discountTotal,
    shippingFeeTotal,
    String(vatRate),
  );

  const wallet = await prisma.wallet.findUnique({
    where: { userId_marketId: { userId: buyerUserId, marketId } },
    select: { availableBalance: true },
  });
  const walletAvailable = wallet?.availableBalance ?? new Prisma.Decimal(0);
  const totalDec = new Prisma.Decimal(totals.totalAmount);
  const walletUseRequested = options.useWalletBalance === true;
  if (walletUseRequested && walletAvailable.lte(0)) {
    throw new CheckoutError(
      "INSUFFICIENT_WALLET_BALANCE",
      "No wallet balance available to use.",
    );
  }
  const walletApplied = walletUseRequested
    ? Prisma.Decimal.min(walletAvailable, totalDec)
    : new Prisma.Decimal(0);
  const remainingAmount = Prisma.Decimal.max(totalDec.sub(walletApplied), new Prisma.Decimal(0));

  return {
    cart,
    shippingFee: totals.shippingFee,
    shippingBreakdown,
    discountTotal: totals.discountTotal,
    vatTotal: totals.vatTotal,
    totalAmount: totals.totalAmount,
    profileComplete,
    shippingAddresses,
    defaultShippingAddressId,
    suggestedShippingAddressId: addressPick.selectedAddressId,
    shippingCountryCode: addressPick.shippingCountryCode,
    activeMarketCode,
    deliveryMismatchMarketCode: addressPick.deliveryMismatchMarketCode,
    coupons: couponsDto,
    cardPaymentsEnabled: isOnlineCardCheckoutEnabled(),
    plannedPaymentGateways: {
      tap: platformConfig.showTapGateway,
      hyperpay: platformConfig.showHyperPayGateway,
      myfatoorah: platformConfig.showMyFatoorahGateway,
    },
    walletAvailableBalance: walletAvailable.toFixed(2),
    walletAppliedAmount: walletApplied.toFixed(2),
    remainingAmount: remainingAmount.toFixed(2),
  };
}

export async function resolveCheckoutShipping(
  buyerUserId: string,
  marketId: string,
  input: PlaceOrderInput,
) {
  const user = await prisma.user.findUnique({
    where: { id: buyerUserId },
    select: { name: true },
  });
  if (!user) {
    throw new CheckoutError("INCOMPLETE_SHIPPING_PROFILE", "User not found.");
  }

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { code: true },
  });
  const activeMarketCode = (market?.code ?? "SA") as MarketCode;

  const savedAddresses = await listAllCustomerShippingAddressesForCheckout(buyerUserId);
  if (savedAddresses.length > 0) {
    const pick = pickShippingAddressForMarket({
      addresses: savedAddresses,
      activeMarketCode,
      requestedAddressId: input.shippingAddressId,
    });
    if (!pick.selectedAddressId) {
      if (pick.deliveryMismatchMarketCode) {
        throw new CheckoutError(
          "DELIVERY_MARKET_MISMATCH",
          `No delivery address for this marketplace. Switch to the ${pick.deliveryMismatchMarketCode} store or add an address for this country.`,
        );
      }
      throw new CheckoutError("INVALID_SHIPPING_ADDRESS", "Pick a valid saved address.");
    }
    const addr = await getCustomerShippingAddressForBuyer(buyerUserId, pick.selectedAddressId);
    if (!addr || !isSavedShippingAddressComplete(addr)) {
      throw new CheckoutError("INVALID_SHIPPING_ADDRESS", "Pick a valid saved address.");
    }
    return buildOrderShippingFromSavedAddress(addr);
  }

  const profile = await getCustomerProfile(buyerUserId);
  assertProfileReadyForCheckout(profile);
  return buildShippingSnapshot(profile, user.name);
}

/** Creates order from cart and clears cart lines. Used for COD and Stripe checkout. */
export async function createOrderFromCart(
  buyerUserId: string,
  marketId: string,
  input: PlaceOrderInput,
  payment: {
    method: "COD" | "ONLINE_CARD";
    status: "PENDING" | "PAID";
    stripeCheckoutSessionId?: string | null;
  },
): Promise<string> {
  const idempotencyKey = input.idempotencyKey?.trim().slice(0, 120) || null;
  const shipping = await resolveCheckoutShipping(buyerUserId, marketId, input);
  assertShippingCountryMatchesMarket({
    countryCode: shipping.shippingCountryCode,
    marketId,
  });

  return prisma.$transaction(async (tx) => {
    const prepared = await loadPreparedCartLines(buyerUserId, marketId, tx);
    if (prepared.length === 0) throw new CheckoutError("EMPTY_CART");
    assertSingleCurrency(prepared);

    let subtotal = new Prisma.Decimal(0);
    for (const line of prepared) {
      subtotal = subtotal.add(line.lineTotal);
    }

    const couponCodes = input.couponCodes ?? (input.couponCode ? [input.couponCode] : undefined);
    const coupons = await resolveOptionalCouponCodes(couponCodes, prepared, tx);
    const discountTotal = coupons?.discountTotal ?? new Prisma.Decimal(0);
    const shippingLines = await resolveShippingForCheckout(
      prepared.map((line) => ({ vendorId: line.vendorId, fulfillmentType: line.fulfillmentType })),
      tx,
    );
    const shippingFee = sumVendorShippingFees(shippingLines);
    const vatRate = await getVatRate(marketId);
    const { vatTotal, totalAmount } = computeOrderTotals(subtotal, discountTotal, shippingFee, vatRate);
    const walletRequested = input.useWalletBalance === true;
    const wallet = walletRequested
      ? await tx.wallet.findUnique({
          where: { userId_marketId: { userId: buyerUserId, marketId } },
          select: { id: true, availableBalance: true },
        })
      : null;
    if (walletRequested && (!wallet || wallet.availableBalance.lte(0))) {
      throw new CheckoutError(
        "INSUFFICIENT_WALLET_BALANCE",
        "No wallet balance available to use.",
      );
    }
    const walletApplied = wallet
      ? Prisma.Decimal.min(wallet.availableBalance, totalAmount)
      : new Prisma.Decimal(0);
    const remainingAmount = Prisma.Decimal.max(totalAmount.sub(walletApplied), new Prisma.Decimal(0));

    if (coupons) {
      await incrementCouponUsedCounts(
        coupons.applications.map((app) => app.couponId),
        tx,
      );
    }

    const orderNo = buildOrderNo();
    const unitItems = buildUnitRowsForOrder(
      orderNo,
      prepared.map((line) => ({
        productId: line.productId,
        vendorId: line.vendorId,
        fulfillmentType: line.fulfillmentType,
        name: line.name,
        vendorName: line.vendorName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
    );

    const order = await tx.order.create({
      data: {
        marketId,
        buyerUserId,
        orderNo,
        status: "NEW",
        subtotal,
        shippingFee,
        discountTotal,
        vatTotal,
        totalAmount,
        couponId: coupons?.codes.length === 1 ? coupons.applications[0]?.couponId ?? null : null,
        couponCodeSnapshot: coupons?.codes.length === 1 ? coupons.codes[0]?.code ?? null : null,
        ...shipping,
        paymentMethod: payment.method,
        paymentStatus: remainingAmount.eq(0) ? "PAID" : payment.status,
        checkoutIdempotencyKey: idempotencyKey,
        stripeCheckoutSessionId: payment.stripeCheckoutSessionId ?? null,
        couponApplications: coupons
          ? {
              create: coupons.applications.map((app) => ({
                couponId: app.couponId,
                vendorId: app.vendorId,
                couponCode: app.couponCode,
                vendorNameSnapshot: app.vendorName,
                discountType: app.discountType,
                discountValue: app.discountValue,
                discountAmount: app.discountTotal,
              })),
            }
          : undefined,
        vendorShippingLines: {
          create: shippingLines.map((line) => ({
            vendorId: line.vendorId,
            vendorNameSnapshot: line.vendorName,
            fulfillmentType: line.fulfillmentType,
            shippingMode: line.shippingMode,
            indirectFulfillment: line.indirectFulfillment,
            fee: line.fee,
          })),
        },
        items: {
          create: unitItems,
        },
      },
      select: { id: true, orderNo: true, totalAmount: true },
    });

    if (walletRequested && walletApplied.gt(0)) {
      if (!wallet || wallet.availableBalance.lt(walletApplied)) {
        throw new CheckoutError("INSUFFICIENT_WALLET_BALANCE", "Wallet balance is not enough.");
      }
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableBalance: { decrement: walletApplied } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: buyerUserId,
          entryType: "ORDER_PAYMENT",
          direction: "DEBIT",
          amount: walletApplied,
          status: "APPROVED",
          referenceType: "order",
          referenceId: order.id,
          idempotencyKey: `order-payment:order:${order.id}`,
          metaJson: {
            orderId: order.id,
            orderNo: order.orderNo,
            kind: "checkout_wallet_payment",
            totalAmount: totalAmount.toFixed(2),
            remainingAmount: remainingAmount.toFixed(2),
          },
        },
      });
    }

    await tx.cartItem.deleteMany({
      where: { id: { in: prepared.map((p) => p.cartItemId) } },
    });

    return order.id;
  });
}

export async function placeOrderFromCart(
  buyerUserId: string,
  marketId: string,
  defaultCurrency: string,
  input: PlaceOrderInput = {},
) {
  const paymentMethod = input.paymentMethod ?? "COD";
  if (paymentMethod === "ONLINE_CARD") {
    if (!isOnlineCardCheckoutEnabled()) {
      throw new CheckoutError("UNSUPPORTED_PAYMENT_METHOD", "Online card payment is not configured.");
    }
    throw new CheckoutError(
      "UNSUPPORTED_PAYMENT_METHOD",
      "Use the Stripe checkout session endpoint for card payments.",
    );
  }

  const idempotencyKey = input.idempotencyKey?.trim().slice(0, 120) || null;
  if (idempotencyKey) {
    const existing = await prisma.order.findFirst({
      where: { buyerUserId, marketId, checkoutIdempotencyKey: idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      const detail = await getCustomerOrderForBuyer(buyerUserId, existing.id, marketId, defaultCurrency);
      if (!detail) throw new Error("ORDER_LOOKUP_INCONSISTENT");
      return detail;
    }
  }

  const orderId = await createOrderFromCart(buyerUserId, marketId, input, {
    method: "COD",
    status: "PENDING",
  });

  const detail = await getCustomerOrderForBuyer(buyerUserId, orderId, marketId, defaultCurrency);
  if (!detail) throw new Error("ORDER_CREATE_INCONSISTENT");
  return detail;
}