import { randomUUID } from "node:crypto";
import type { CustomerProfileDto, CustomerShippingAddressDto, ProductFulfillmentTypeCode } from "@mlm/shared";
import { getPlatformConfig } from "../platform-config/platform-config.service";
import { Prisma, prisma } from "@mlm/db";
import {
  computeCheckoutVat,
  type CheckoutVatLineDto,
} from "./checkout-vat.service";
import {
  assertMarketOfferStock,
  decrementMarketOfferStock,
  InventoryError,
} from "../catalog/inventory.service";
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
import { computeWalletBalanceBuckets } from "../wallet/wallet.service";
import {
  isOnlineCardPaymentConfigured,
  resolvePaymentGatewayId,
} from "../payments/payment-config";
import { assertShippingCountryMatchesMarket, pickShippingAddressForMarket } from "./delivery-market";
import type { MarketCode } from "@mlm/shared";
import {
  computeServiceAreaWarnings,
  type CartDeliveryIssueDto,
} from "../shipping/product-service-area.service";
import { isUserEmailVerified } from "../auth/otp-verification.service";
import { isSameCityDelivery } from "../commission/commission-rate.service";

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
      | "DELIVERY_MARKET_MISMATCH"
      | "EMAIL_VERIFICATION_REQUIRED"
      | "PRODUCT_OUTSIDE_COVERAGE"
      | "CART_DELIVERY_MISMATCH"
      | "COD_NOT_AVAILABLE"
      | "INSUFFICIENT_STOCK"
      | "OFFER_NOT_FOUND"
      | "SETTLEMENT_RISK_REQUIRED"
      | "POLICY_CONSENT_REQUIRED"
      | "AMOUNT_MISMATCH",
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
  buyingForCompany?: boolean;
  companyName?: string | null;
  companyTaxId?: string | null;
  companyCrNumber?: string | null;
  companyHqAddressLine1?: string | null;
  companyHqCity?: string | null;
  companyHqCountryCode?: string | null;
  settlementRiskAccepted?: boolean;
  /** Phase 3 checkout policy consents. */
  acceptTerms?: boolean;
  acceptReturns?: boolean;
  acceptShipping?: boolean;
  /** Optional request metadata for consent ledger. */
  consentIpAddress?: string | null;
  consentUserAgent?: string | null;
};

export type CheckoutDeliveryIssueDto = CartDeliveryIssueDto;

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
  variantId?: string | null;
  variantTitle?: string | null;
  variantSku?: string | null;
  name: string;
  vendorName: string;
  fulfillmentType: ProductFulfillmentTypeCode;
  quantity: number;
  unitPrice: Prisma.Decimal;
  stockLocation?: "MERCHANT" | "VANDSOQ_WAREHOUSE";
  warehouseId?: string | null;
  warehouseCountry?: string | null;
  merchantCountry?: string | null;
  merchantCity?: string | null;
  vandsoqMode?: "FORSEIZ_STOCK" | "ON_ORDER" | null;
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
      variant: {
        select: {
          id: true,
          title: true,
          sku: true,
          isActive: true,
          offers: {
            where: { marketId },
            take: 1,
            select: { price: true, currency: true },
          },
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          status: true,
          vendorId: true,
          fulfillmentType: true,
          vendor: { select: { storeName: true, countryCode: true, city: true } },
          marketOffers: {
            where: { marketId, status: "APPROVED" },
            take: 1,
            select: {
              price: true,
              currency: true,
              stockLocation: true,
              warehouseId: true,
              vandsoqMode: true,
              warehouse: { select: { countryCode: true } },
            },
          },
        },
      },
    },
  });

  const prepared: PreparedCartLine[] = [];
  for (const row of rows) {
    const p = row.product;
    if (!p || p.status !== "PUBLISHED") continue;
    const offer = p.marketOffers[0];
    // Phase 5: require an approved sell-market offer (no legacy Product.price fallback).
    if (!offer) continue;
    const variantOffer = row.variant?.isActive ? row.variant.offers[0] : null;
    if (row.variantId && (!row.variant?.isActive || !variantOffer)) continue;
    const unitPrice = new Prisma.Decimal((variantOffer?.price ?? offer.price).toString());
    const displayName =
      row.variant?.title && row.variant.isActive ? `${p.name} — ${row.variant.title}` : p.name;
    prepared.push({
      cartItemId: row.id,
      productId: p.id,
      variantId: row.variantId,
      variantTitle: row.variant?.isActive ? row.variant.title : null,
      variantSku: row.variant?.isActive ? row.variant.sku : null,
      vendorId: p.vendorId,
      name: displayName,
      vendorName: p.vendor.storeName,
      fulfillmentType: (offer?.vandsoqMode === "ON_ORDER"
        ? "ON_ORDER"
        : offer?.stockLocation === "VANDSOQ_WAREHOUSE"
          ? "FORSEIZ_STOCK"
          : p.fulfillmentType) as ProductFulfillmentTypeCode,
      quantity: row.quantity,
      unitPrice,
      lineTotal: unitPrice.mul(row.quantity),
      currency: variantOffer?.currency || offer?.currency || p.currency || "SAR",
      stockLocation: offer?.stockLocation,
      warehouseId: offer?.warehouseId,
      warehouseCountry: offer?.warehouse?.countryCode ?? null,
      merchantCountry: p.vendor.countryCode,
      merchantCity: p.vendor.city,
      vandsoqMode: offer?.vandsoqMode ?? null,
    });
  }
  return prepared;
}

function isDirectMerchantLine(line: PreparedCartLine): boolean {
  if (line.stockLocation === "VANDSOQ_WAREHOUSE") return false;
  if (line.fulfillmentType === "FORSEIZ_STOCK" || line.fulfillmentType === "ON_ORDER") return false;
  return line.stockLocation === "MERCHANT" || line.fulfillmentType === "DIRECT";
}

/** Phase 4 COD: kill-switch + every line direct merchant + same city as vendor. */
export async function assertCodAllowedForCart(params: {
  marketId: string;
  shipToCity: string;
  lines: PreparedCartLine[];
}): Promise<void> {
  const config = await getPlatformConfig(params.marketId);
  if (!config.codEnabled) {
    throw new CheckoutError(
      "COD_NOT_AVAILABLE",
      "Cash on delivery is temporarily disabled.",
    );
  }
  if (params.lines.length === 0) {
    throw new CheckoutError("EMPTY_CART");
  }
  for (const line of params.lines) {
    if (!isDirectMerchantLine(line)) {
      throw new CheckoutError(
        "COD_NOT_AVAILABLE",
        "Cash on delivery is only available for direct vendor delivery in the vendor's city.",
      );
    }
    if (
      !isSameCityDelivery({
        vendorCity: line.merchantCity,
        shipToCity: params.shipToCity,
      })
    ) {
      throw new CheckoutError(
        "COD_NOT_AVAILABLE",
        "Cash on delivery is only available when the delivery city matches the vendor's city.",
      );
    }
  }
}

export async function isCodAvailableForCheckout(params: {
  marketId: string;
  shipToCity: string;
  lines: PreparedCartLine[];
}): Promise<boolean> {
  try {
    await assertCodAllowedForCart(params);
    return true;
  } catch (e) {
    if (e instanceof CheckoutError && e.code === "COD_NOT_AVAILABLE") return false;
    throw e;
  }
}

function assertSingleCurrency(prepared: PreparedCartLine[]): void {
  if (prepared.length === 0) throw new CheckoutError("EMPTY_CART");
  const firstCurrency = prepared[0].currency;
  if (prepared.some((line) => line.currency !== firstCurrency)) {
    throw new CheckoutError("MIXED_CURRENCY", "Cart contains multiple currencies");
  }
}

function finalizeOrderMoney(
  subtotal: Prisma.Decimal,
  discountTotal: Prisma.Decimal,
  shippingFee: Prisma.Decimal,
  vatTotal: Prisma.Decimal,
) {
  const totalAmount = subtotal.add(shippingFee).add(vatTotal).sub(discountTotal);
  return { shippingFee, vatTotal, totalAmount };
}

async function resolveOptionalCoupons(
  couponCode: string | null | undefined,
  prepared: PreparedCartLine[],
  db: Prisma.TransactionClient | typeof prisma,
  marketId?: string,
): Promise<CouponsCheckoutResolution | null> {
  const trimmed = couponCode?.trim();
  if (!trimmed) return null;
  try {
    return await resolveCouponsForCheckout(trimmed, prepared, db, marketId);
  } catch (e) {
    if (e instanceof CouponCheckoutError) throw mapCouponCheckoutError(e);
    throw e;
  }
}

async function resolveOptionalCouponCodes(
  couponCodes: string[] | null | undefined,
  prepared: PreparedCartLine[],
  db: Prisma.TransactionClient | typeof prisma,
  marketId?: string,
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
      resolved = await resolveCouponsForCheckout(code, prepared, db, marketId);
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
  // Active PSP only (default Tap). Stripe stays in repo but is ignored unless PAYMENT_GATEWAY=stripe.
  return isOnlineCardPaymentConfigured();
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
  vatBreakdown: CheckoutVatLineDto[];
  displayVatPercent: number | null;
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
  activePaymentGateway: "stripe" | "hyperpay" | "tap" | "myfatoorah";
  plannedPaymentGateways: {
    tap: boolean;
    hyperpay: boolean;
    myfatoorah: boolean;
  };
  walletAvailableBalance: string;
  walletAppliedAmount: string;
  remainingAmount: string;
  emailVerified: boolean;
  deliveryIssues: CheckoutDeliveryIssueDto[];
}> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { defaultCurrency: true, code: true },
  });
  const defaultCurrency = market?.defaultCurrency ?? "SAR";
  const activeMarketCode = (market?.code ?? "SA") as MarketCode;
  const emailVerified = await isUserEmailVerified(buyerUserId);

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
    const coupons = await resolveOptionalCouponCodes(couponCodes, prepared, prisma, marketId);
    if (coupons) {
      discountTotal = coupons.discountTotal.toFixed(2);
      couponsDto = { codes: coupons.codes, discountTotal };
    }
    const shippingLines = await resolveShippingForCheckout(
      prepared.map((line) => ({
        vendorId: line.vendorId,
        fulfillmentType: line.fulfillmentType,
        stockLocation: line.stockLocation,
        warehouseId: line.warehouseId,
        warehouseCountry: line.warehouseCountry,
        merchantCountry: line.merchantCountry,
        customerCountry: addressPick.shippingCountryCode,
        vandsoqMode: line.vandsoqMode,
        quantity: line.quantity,
      })),
      marketId,
      prisma,
    );
    shippingBreakdown = shippingBreakdownToDto(shippingLines);
    shippingFeeTotal = sumVendorShippingFees(shippingLines).toFixed(2);
  }

  const platformConfig = await getPlatformConfig(marketId);
  const vat = await computeCheckoutVat({
    marketId,
    lines: prepared.map((line) => ({
      vendorId: line.vendorId,
      vendorName: line.vendorName,
      lineTotal: line.lineTotal,
    })),
    shippingLines: shippingBreakdown.map((line) => ({
      vendorId: line.vendorId,
      vendorName: line.vendorName,
      fulfillmentType: line.fulfillmentType,
      fee: line.fee,
    })),
    discountTotal: Number(discountTotal) || 0,
  });
  const subNum = Math.round((Number.parseFloat(cart.subtotal) || 0) * 100) / 100;
  const shipNum = Math.round((Number.parseFloat(shippingFeeTotal) || 0) * 100) / 100;
  const discNum = Math.round((Number.parseFloat(discountTotal) || 0) * 100) / 100;
  const vatNum = Math.round((Number.parseFloat(vat.vatTotal) || 0) * 100) / 100;
  const totalNum = Math.round((subNum + shipNum - discNum + vatNum) * 100) / 100;
  const totals = {
    subtotal: subNum.toFixed(2),
    shippingFee: shipNum.toFixed(2),
    discountTotal: discNum.toFixed(2),
    vatTotal: vat.vatTotal,
    totalAmount: totalNum.toFixed(2),
  };

  const wallet = await prisma.wallet.findUnique({
    where: { userId_marketId: { userId: buyerUserId, marketId } },
    select: { id: true, availableBalance: true },
  });
  let walletAvailable = new Prisma.Decimal(0);
  if (wallet) {
    const buckets = await computeWalletBalanceBuckets(wallet.id);
    walletAvailable = new Prisma.Decimal(buckets.cashbackAvailable);
  }
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

  let deliveryIssues: CheckoutDeliveryIssueDto[] = [];
  if (prepared.length > 0) {
    const selectedAddr = addressPick.selectedAddressId
      ? shippingAddresses.find((row) => row.id === addressPick.selectedAddressId)
      : null;
    const shipCity = selectedAddr?.city?.trim() ?? profile?.shippingCity?.trim() ?? profile?.city?.trim();
    const shipCountry =
      selectedAddr?.countryCode?.trim().toUpperCase() ??
      profile?.shippingCountryCode?.trim().toUpperCase() ??
      profile?.countryCode?.trim().toUpperCase() ??
      addressPick.shippingCountryCode;
    if (shipCity && shipCountry) {
      const warnings = await computeServiceAreaWarnings({
        lines: prepared.map((line) => ({
          itemId: line.cartItemId,
          productId: line.productId,
          productName: line.name,
          vendorId: line.vendorId,
          stockLocation: line.stockLocation,
        })),
        countryCode: shipCountry,
        city: shipCity,
      });
      deliveryIssues = warnings
        .map((warning) => {
          const itemId =
            warning.itemId ??
            prepared.find((line) => line.productId === warning.productId)?.cartItemId;
          if (!itemId) return null;
          return { ...warning, itemId };
        })
        .filter((row): row is CheckoutDeliveryIssueDto => row !== null);
    }
  }

  return {
    cart,
    shippingFee: totals.shippingFee,
    shippingBreakdown,
    discountTotal: totals.discountTotal,
    vatTotal: totals.vatTotal,
    vatBreakdown: vat.vatBreakdown,
    displayVatPercent: vat.displayVatPercent,
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
    activePaymentGateway: resolvePaymentGatewayId(),
    plannedPaymentGateways: {
      tap: platformConfig.showTapGateway,
      hyperpay: platformConfig.showHyperPayGateway,
      myfatoorah: platformConfig.showMyFatoorahGateway,
    },
    walletAvailableBalance: walletAvailable.toFixed(2),
    walletAppliedAmount: walletApplied.toFixed(2),
    remainingAmount: remainingAmount.toFixed(2),
    emailVerified,
    deliveryIssues,
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

/**
 * Decimal places for comparing captured card amounts to live cart remaining.
 * Matches Tap amount formatting (OMR/BHD/KWD/JOD = 3; else 2).
 */
export function formatCheckoutMoneyAmount(amount: number | string, currency: string): string {
  const n = typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(n) || n < 0) {
    throw new CheckoutError("AMOUNT_MISMATCH", "Invalid payment amount.");
  }
  const code = currency.trim().toUpperCase();
  const decimals = code === "OMR" || code === "BHD" || code === "KWD" || code === "JOD" ? 3 : 2;
  return n.toFixed(decimals);
}

/** Creates order from cart and clears cart lines. Used for COD and card checkout. */
export async function createOrderFromCart(
  buyerUserId: string,
  marketId: string,
  input: PlaceOrderInput,
  payment: {
    method: "COD" | "ONLINE_CARD";
    status: "PENDING" | "PAID";
    stripeCheckoutSessionId?: string | null;
    tapChargeId?: string | null;
    /**
     * Amount captured by the PSP for the card portion (major units).
     * Required when status is PAID and a Tap/Stripe reference is set — compared to
     * live cart remaining inside the transaction (blocks cart-change underpayment).
     */
    capturedCardAmount?: string | null;
    capturedCardCurrency?: string | null;
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

    const deliveryIssues = await computeServiceAreaWarnings({
      lines: prepared.map((line) => ({
        itemId: line.cartItemId,
        productId: line.productId,
        productName: line.name,
        vendorId: line.vendorId,
        stockLocation: line.stockLocation,
      })),
      countryCode: shipping.shippingCountryCode,
      city: shipping.shippingCity,
    });
    if (deliveryIssues.length > 0) {
      const names = deliveryIssues.map((issue) => issue.productName).join(", ");
      throw new CheckoutError(
        "CART_DELIVERY_MISMATCH",
        `Remove items that cannot be delivered to your address before checkout: ${names}.`,
      );
    }

    if (payment.method === "COD") {
      await assertCodAllowedForCart({
        marketId,
        shipToCity: shipping.shippingCity,
        lines: prepared,
      });
    }

    let subtotal = new Prisma.Decimal(0);
    for (const line of prepared) {
      subtotal = subtotal.add(line.lineTotal);
    }

    const stockLines = prepared.map((line) => ({
      productId: line.productId,
      productName: line.name,
      quantity: line.quantity,
      variantId: line.variantId,
      vandsoqMode: line.vandsoqMode,
      stockLocation: line.stockLocation,
      fulfillmentType: line.fulfillmentType,
    }));
    try {
      await assertMarketOfferStock(tx, marketId, stockLines);
    } catch (e) {
      if (e instanceof InventoryError) {
        throw new CheckoutError(e.code, e.message);
      }
      throw e;
    }

    const couponCodes = input.couponCodes ?? (input.couponCode ? [input.couponCode] : undefined);
    const coupons = await resolveOptionalCouponCodes(couponCodes, prepared, tx, marketId);
    const discountTotal = coupons?.discountTotal ?? new Prisma.Decimal(0);
    const shippingLines = await resolveShippingForCheckout(
      prepared.map((line) => ({
        vendorId: line.vendorId,
        fulfillmentType: line.fulfillmentType,
        stockLocation: line.stockLocation,
        warehouseId: line.warehouseId,
        warehouseCountry: line.warehouseCountry,
        merchantCountry: line.merchantCountry,
        customerCountry: shipping.shippingCountryCode,
        vandsoqMode: line.vandsoqMode,
        quantity: line.quantity,
      })),
      marketId,
      tx,
    );
    const shippingFee = sumVendorShippingFees(shippingLines);
    const vatComputed = await computeCheckoutVat({
      marketId,
      lines: prepared.map((line) => ({
        vendorId: line.vendorId,
        vendorName: line.vendorName,
        lineTotal: line.lineTotal,
      })),
      shippingLines: shippingLines.map((line) => ({
        vendorId: line.vendorId,
        vendorName: line.vendorName,
        fulfillmentType: line.fulfillmentType,
        fee: line.fee,
      })),
      discountTotal: Number(discountTotal),
    });
    const vatTotal = new Prisma.Decimal(vatComputed.vatTotal);
    const { totalAmount } = finalizeOrderMoney(subtotal, discountTotal, shippingFee, vatTotal);
    const walletRequested = input.useWalletBalance === true;
    let cashbackAvailableDec = new Prisma.Decimal(0);
    if (walletRequested) {
      const walletRow = await tx.wallet.findUnique({
        where: { userId_marketId: { userId: buyerUserId, marketId } },
        select: { id: true },
      });
      if (!walletRow) {
        throw new CheckoutError(
          "INSUFFICIENT_WALLET_BALANCE",
          "No wallet balance available to use.",
        );
      }
      const buckets = await computeWalletBalanceBuckets(walletRow.id);
      cashbackAvailableDec = new Prisma.Decimal(buckets.cashbackAvailable);
      if (cashbackAvailableDec.lte(0)) {
        throw new CheckoutError(
          "INSUFFICIENT_WALLET_BALANCE",
          "No cashback balance available to use.",
        );
      }
    }
    const wallet = walletRequested
      ? await tx.wallet.findUnique({
          where: { userId_marketId: { userId: buyerUserId, marketId } },
          select: { id: true, availableBalance: true },
        })
      : null;
    const walletApplied = wallet
      ? Prisma.Decimal.min(cashbackAvailableDec, totalAmount)
      : new Prisma.Decimal(0);
    const remainingAmount = Prisma.Decimal.max(totalAmount.sub(walletApplied), new Prisma.Decimal(0));

    const hasCardRef = Boolean(payment.tapChargeId || payment.stripeCheckoutSessionId);
    if (payment.method === "ONLINE_CARD" && payment.status === "PAID" && hasCardRef) {
      const currency = prepared[0]!.currency.toUpperCase();
      const capturedCurrency = payment.capturedCardCurrency?.trim().toUpperCase() ?? "";
      const capturedRaw = payment.capturedCardAmount?.trim() ?? "";
      if (!capturedRaw || !capturedCurrency) {
        throw new CheckoutError(
          "AMOUNT_MISMATCH",
          "Captured card amount is missing; cannot finalize this payment.",
        );
      }
      if (capturedCurrency !== currency) {
        throw new CheckoutError(
          "AMOUNT_MISMATCH",
          "Payment currency does not match the cart. Start checkout again.",
        );
      }
      const expected = formatCheckoutMoneyAmount(remainingAmount.toString(), currency);
      const captured = formatCheckoutMoneyAmount(capturedRaw, currency);
      if (expected !== captured) {
        throw new CheckoutError(
          "AMOUNT_MISMATCH",
          "Cart total changed after payment. Your card was charged the original amount; restore the cart or contact support for a refund.",
        );
      }
    }

    if (coupons) {
      await incrementCouponUsedCounts(
        coupons.applications.map((app) => ({
          couponId: app.couponId,
          isPlatform: app.isPlatform === true,
        })),
        tx,
      );
    }

    const orderNo = buildOrderNo();
    const unitItems = buildUnitRowsForOrder(
      orderNo,
      prepared.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        vendorId: line.vendorId,
        fulfillmentType: line.fulfillmentType,
        name: line.name,
        vendorName: line.vendorName,
        variantTitle: line.variantTitle,
        variantSku: line.variantSku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
    );

    const buyingForCompany = input.buyingForCompany === true;
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
        buyingForCompany,
        companyName: buyingForCompany ? input.companyName?.trim() || null : null,
        companyTaxId: buyingForCompany ? input.companyTaxId?.trim() || null : null,
        companyCrNumber: buyingForCompany ? input.companyCrNumber?.trim() || null : null,
        companyHqAddressLine1: buyingForCompany
          ? input.companyHqAddressLine1?.trim() || null
          : null,
        companyHqCity: buyingForCompany ? input.companyHqCity?.trim() || null : null,
        companyHqCountryCode: buyingForCompany
          ? input.companyHqCountryCode?.trim().toUpperCase() || null
          : null,
        settlementRiskAcceptedAt: input.settlementRiskAccepted === true ? new Date() : null,
        couponId:
          coupons?.codes.length === 1 && coupons.applications[0]?.isPlatform !== true
            ? coupons.applications[0]?.couponId ?? null
            : null,
        couponCodeSnapshot: coupons?.codes.length === 1 ? coupons.codes[0]?.code ?? null : null,
        ...shipping,
        paymentMethod: payment.method,
        paymentStatus: remainingAmount.eq(0) ? "PAID" : payment.status,
        checkoutIdempotencyKey: idempotencyKey,
        stripeCheckoutSessionId: payment.stripeCheckoutSessionId ?? null,
        tapChargeId: payment.tapChargeId ?? null,
        couponApplications: (() => {
          const vendorApps =
            coupons?.applications.filter((app) => app.isPlatform !== true) ?? [];
          if (vendorApps.length === 0) return undefined;
          return {
            create: vendorApps.map((app) => ({
              couponId: app.couponId,
              vendorId: app.vendorId,
              couponCode: app.couponCode,
              vendorNameSnapshot: app.vendorName,
              discountType: app.discountType,
              discountValue: app.discountValue,
              discountAmount: app.discountTotal,
            })),
          };
        })(),
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

    try {
      await decrementMarketOfferStock(tx, marketId, stockLines);
    } catch (e) {
      if (e instanceof InventoryError) {
        throw new CheckoutError(e.code, e.message);
      }
      throw e;
    }

    await tx.cartItem.deleteMany({
      where: { id: { in: prepared.map((p) => p.cartItemId) } },
    });

    if (
      input.acceptTerms === true &&
      input.acceptReturns === true &&
      input.acceptShipping === true
    ) {
      const { recordCurrentPolicyConsents, CUSTOMER_CHECKOUT_DOCUMENT_TYPES } = await import(
        "../legal/consent-ledger.service"
      );
      await recordCurrentPolicyConsents({
        userId: buyerUserId,
        marketId,
        context: "CUSTOMER_CHECKOUT",
        documentTypes: CUSTOMER_CHECKOUT_DOCUMENT_TYPES,
        orderId: order.id,
        ipAddress: input.consentIpAddress,
        userAgent: input.consentUserAgent,
        tx,
      });
    }

    return order.id;
  });
}

export async function placeOrderFromCart(
  buyerUserId: string,
  marketId: string,
  defaultCurrency: string,
  input: PlaceOrderInput = {},
) {
  if (!(await isUserEmailVerified(buyerUserId))) {
    throw new CheckoutError(
      "EMAIL_VERIFICATION_REQUIRED",
      "Verify your email with the one-time code before placing your first order.",
    );
  }
  if (input.settlementRiskAccepted !== true) {
    throw new CheckoutError(
      "SETTLEMENT_RISK_REQUIRED",
      "Accept FX, transfer fee, and customs risk terms to continue checkout.",
    );
  }
  if (input.acceptTerms !== true || input.acceptReturns !== true || input.acceptShipping !== true) {
    throw new CheckoutError(
      "POLICY_CONSENT_REQUIRED",
      "Accept Terms, Returns, and Shipping policies to continue checkout.",
    );
  }

  const paymentMethod = input.paymentMethod ?? "COD";
  if (paymentMethod === "ONLINE_CARD") {
    if (!isOnlineCardCheckoutEnabled()) {
      throw new CheckoutError("UNSUPPORTED_PAYMENT_METHOD", "Online card payment is not configured.");
    }
    throw new CheckoutError(
      "UNSUPPORTED_PAYMENT_METHOD",
      "Use the card checkout session endpoint for online card payments.",
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