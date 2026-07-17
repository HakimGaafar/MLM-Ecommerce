import type { RoleCode } from "@mlm/shared";
import { VENDOR_PERMISSION_CODES } from "@mlm/shared";

export {
  settlementWindowDays,
  settlementWindowHours,
  returnWindowDays,
  week1BusinessRules,
  affiliateRankTitles,
  defaultAffiliateRankTitle,
  getMinWithdrawalAmountSarFromEnv,
  type MissingAncestorPolicy,
  type AffiliateRankTitle,
} from "./business-rules";

export {
  getPlatformConfig,
  getMinWithdrawalAmount,
  getMinWithdrawalAmountSar,
  getReturnWindowDays,
  getVatRate,
  getDefaultPlatformConfigSnapshot,
  toPlatformConfigAdminDto,
  buildPlatformConfigSeedData,
  invalidatePlatformConfigCache,
  type PlatformConfigSnapshot,
  type PlatformConfigAdminDto,
} from "./platform-config/platform-config.service";
export {
  getAdminPlatformConfig,
  updateAdminPlatformConfig,
} from "./platform-config/admin-platform-config.service";

export const roleCapabilities: Record<RoleCode, string[]> = {
  ADMIN: ["admin:*"],
  VENDOR: [...VENDOR_PERMISSION_CODES],
  CUSTOMER: ["marketplace:buy", "orders:read", "wallet:read"],
  AFFILIATE: ["referral:read", "commission:read"],
};

export function hasCapability(roles: RoleCode[], capability: string): boolean {
  return roles.some((role) => {
    const permissions = roleCapabilities[role] ?? [];
    return permissions.includes("admin:*") || permissions.includes(capability);
  });
}

export * from "./orders/order-fulfillment-groups.service";
export * from "./orders/order-units.service";
export * from "./orders/fulfillment-sla";
export * from "./orders/order-stuck.service";
export * from "./orders/order-escalation.service";
export * from "./orders/order-admin-notes.service";
export * from "./orders/order-customer-notice.service";
export * from "./orders/order-vendor-cancel.service";
export * from "./customer/profile.service";
export * from "./customer/international-notice.service";
export * from "./customer/customer-dashboard.service";
export * from "./customer/orders.service";
export * from "./customer/cart.service";
export * from "./customer/checkout.service";
export * from "./customer/coupon-checkout.service";
export * from "./customer/returns.service";
export * from "./customer/return-refund-timeline";
export * from "./customer/order-item-ratings.service";
export * from "./customer/customer-addresses.service";
export * from "./customer/shipping-profile";
export * from "./catalog/public-catalog.service";
export * from "./catalog/market-banners.service";
export * from "./catalog/product-categories.service";
export * from "./catalog/product-questions.service";
export * from "./catalog/public-store.service";
export * from "./seller/seller-onboarding.service";
export * from "./vendor/vendor-context.service";
export * from "./vendor/vendor-access.service";
export * from "./vendor/vendor-products.service";
export * from "./vendor/vendor-product-questions.service";
export * from "./vendor/vendor-reviews.service";
export * from "./vendor/vendor-product-import.service";
export * from "./vendor/vendor-team.service";
export * from "./vendor/vendor-plans.service";
export * from "./payments/stripe-checkout.service";
export * from "./payments/stripe-refund.service";
export * from "./payments/payment-gateway";
export * from "./affiliate/international-consent.service";
export {
  getStripeClient,
  stripeAmountFromDecimalString,
} from "./payments/stripe-client";
export * from "./vendor/vendor-orders.service";
export * from "./vendor/vendor-store.service";
export * from "./vendor/vendor-setup.service";
export * from "./vendor/vendor-shipping.service";
export * from "./shipping/shipping-checkout.service";
export * from "./admin/admin-vendor-shipping.service";
export * from "./vendor/vendor-analytics.service";
export * from "./vendor/vendor-permissions.service";
export * from "./vendor/vendor-coupons.service";
export * from "./vendor/vendor-wallet.service";
export * from "./admin/admin-product-approval.service";
export * from "./admin/admin-orders.service";
export * from "./admin/admin-users.service";
export * from "./admin/admin-vendors.service";
export * from "./admin/admin-vendor-fulfillment-metrics.service";
export * from "./admin/admin-analytics.service";
export * from "./admin/admin-dashboard-overview.service";
export * from "./admin/admin-withdrawals.service";
export * from "./admin/admin-settlements.service";
export * from "./admin/admin-affiliates.service";
export * from "./wallet/wallet-settlement.service";
export * from "./wallet/affiliate-withdrawal.service";
export * from "./admin/admin-returns.service";
export * from "./wallet/wallet.service";
export * from "./wallet/affiliate-commission.service";
export * from "./wallet/vendor-earning.service";
export * from "./kyc/kyc-requirements";
export * from "./kyc/kyc-expiry";
export * from "./kyc/kyc-document.service";
export * from "./kyc/kyc-withdraw-gate";
export * from "./admin/admin-kyc.service";
export * from "./admin/admin-markets.service";
export * from "./affiliate/affiliate-dashboard.service";
export * from "./invoices/platform-entity";
export * from "./invoices/invoice-calculation";
export * from "./invoices/vendor-invoice-profile.service";
export * from "./invoices/order-invoice.service";
export * from "./referral/referral-bind.service";
export * from "./contact/contact-inquiry.service";
