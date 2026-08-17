import { NextResponse } from "next/server";
import {
  AffiliateDashboardError,
  AffiliateWithdrawalError,
  CheckoutError,
  KycDocumentError,
  KycWithdrawGateError,
  OtpVerificationError,
  ReferralBindError,
  SellerOnboardError,
  StripeCheckoutError,
  VendorCouponError,
  VendorOrderError,
  VendorProductError,
  VendorTeamError,
  WalletError,
} from "@mlm/domain";

/** Safe, user-facing API error copy (English — UI i18n handles display where wired). */
export const PUBLIC_API_ERRORS = {
  generic: "Something went wrong. Please try again.",
  serviceUnavailable: "This feature is temporarily unavailable. Please try again later.",
  registrationFailed: "Registration failed. Please try again later.",
  notFound: "The requested item was not found.",
  forbidden: "You do not have permission to perform this action.",
  unauthorized: "Unauthorized",
  validationFailed: "Validation failed.",
  checkoutFailed: "Checkout failed. Please try again.",
  withdrawFailed: "Could not submit withdrawal. Please try again.",
  affiliateUnavailable: "Affiliate features are temporarily unavailable. Please try again later.",
} as const;

const INTERNAL_MESSAGE_PATTERNS = [
  /run database seed/i,
  /roles are missing/i,
  /roles missing/i,
  /role is missing/i,
  /affiliate role is missing/i,
  /prisma/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /connection refused/i,
  /database/i,
  /sql/i,
  /INCONSISTENT/i,
  /JWT_SECRET/i,
  /STRIPE_SECRET/i,
  /not configured on this server/i,
  /at\s+\S+\.(ts|js):\d+/i,
];

function looksLikeInternalCode(message: string): boolean {
  const trimmed = message.trim();
  return /^[A-Z0-9_]+$/.test(trimmed) && trimmed.length >= 4;
}

export function isInternalErrorMessage(message: string | undefined | null): boolean {
  if (!message?.trim()) return false;
  if (looksLikeInternalCode(message)) return true;
  return INTERNAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function sanitizeClientErrorMessage(
  message: string | undefined | null,
  fallback: string = PUBLIC_API_ERRORS.generic,
): string {
  if (!message?.trim()) return fallback;
  if (isInternalErrorMessage(message)) return fallback;
  return message.trim();
}

export function logApiError(context: string, error: unknown): void {
  console.error(`[api:${context}]`, error);
}

export function internalServerErrorResponse(
  context: string,
  error: unknown,
  userMessage: string = PUBLIC_API_ERRORS.serviceUnavailable,
): NextResponse {
  logApiError(context, error);
  return NextResponse.json({ error: userMessage }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

function sellerOnboardPublicMessage(error: SellerOnboardError): string {
  if (error.code === "ROLES_MISSING") return PUBLIC_API_ERRORS.serviceUnavailable;
  return sanitizeClientErrorMessage(error.message, PUBLIC_API_ERRORS.generic);
}

function referralBindPublicMessage(error: ReferralBindError): string {
  return sanitizeClientErrorMessage(error.message, PUBLIC_API_ERRORS.registrationFailed);
}

function otpPublicMessage(error: OtpVerificationError): string {
  return sanitizeClientErrorMessage(error.message, PUBLIC_API_ERRORS.generic);
}

function checkoutPublicMessage(error: CheckoutError): string {
  return sanitizeClientErrorMessage(error.message, PUBLIC_API_ERRORS.checkoutFailed);
}

function stripeCheckoutPublicMessage(error: StripeCheckoutError): string {
  if (error.code === "NOT_CONFIGURED") return PUBLIC_API_ERRORS.serviceUnavailable;
  return sanitizeClientErrorMessage(error.message, PUBLIC_API_ERRORS.checkoutFailed);
}

function affiliateDashboardPublicMessage(error: AffiliateDashboardError): string {
  return sanitizeClientErrorMessage(error.message, PUBLIC_API_ERRORS.affiliateUnavailable);
}

function walletPublicMessage(error: WalletError): string {
  return sanitizeClientErrorMessage(error.message, PUBLIC_API_ERRORS.withdrawFailed);
}

function kycWithdrawPublicMessage(error: KycWithdrawGateError): string {
  return sanitizeClientErrorMessage(error.message, PUBLIC_API_ERRORS.withdrawFailed);
}

/** Map a caught error to a client-safe message. Logs internal details when context is set. */
export function publicErrorMessage(
  error: unknown,
  fallback: string = PUBLIC_API_ERRORS.generic,
  context?: string,
): string {
  if (error instanceof SellerOnboardError) return sellerOnboardPublicMessage(error);
  if (error instanceof ReferralBindError) return referralBindPublicMessage(error);
  if (error instanceof OtpVerificationError) return otpPublicMessage(error);
  if (error instanceof CheckoutError) return checkoutPublicMessage(error);
  if (error instanceof StripeCheckoutError) return stripeCheckoutPublicMessage(error);
  if (error instanceof AffiliateDashboardError) return affiliateDashboardPublicMessage(error);
  if (error instanceof WalletError) return walletPublicMessage(error);
  if (error instanceof KycWithdrawGateError) return kycWithdrawPublicMessage(error);
  if (error instanceof AffiliateWithdrawalError) {
    return sanitizeClientErrorMessage(error.message, PUBLIC_API_ERRORS.withdrawFailed);
  }
  if (
    error instanceof VendorProductError ||
    error instanceof VendorCouponError ||
    error instanceof VendorTeamError ||
    error instanceof VendorOrderError ||
    error instanceof KycDocumentError
  ) {
    return sanitizeClientErrorMessage(error.message, fallback);
  }

  if (error instanceof Error) {
    if (context && isInternalErrorMessage(error.message)) {
      logApiError(context, error);
    }
    return sanitizeClientErrorMessage(error.message, fallback);
  }

  if (context) logApiError(context, error);
  return fallback;
}

/** Whether to expose machine-readable error codes to the client (local dev only). */
export function exposeErrorCodesToClient(): boolean {
  return process.env.NODE_ENV === "development";
}

export function publicErrorPayload(
  error: unknown,
  options: {
    fallback?: string;
    context?: string;
    code?: string;
  } = {},
): { error: string; code?: string } {
  const message = publicErrorMessage(error, options.fallback ?? PUBLIC_API_ERRORS.generic, options.context);
  const payload: { error: string; code?: string } = { error: message };

  if (exposeErrorCodesToClient()) {
    if (options.code) payload.code = options.code;
    else if (
      error instanceof Error &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
    ) {
      const code = (error as { code: string }).code;
      if (!isInternalErrorMessage(code)) payload.code = code;
    }
  }

  return payload;
}

export function publicErrorResponse(
  error: unknown,
  status: number,
  options: {
    fallback?: string;
    context?: string;
    code?: string;
  } = {},
): NextResponse {
  return NextResponse.json(publicErrorPayload(error, options), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
