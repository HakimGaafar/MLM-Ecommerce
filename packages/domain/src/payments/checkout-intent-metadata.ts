import type { PlaceOrderInput } from "../customer/checkout.service";

/** Pack PlaceOrderInput fields that must survive PSP redirect (Tap/Stripe metadata). */
export function packCheckoutIntentMetadata(
  input: PlaceOrderInput,
  extra: Record<string, string> = {},
): Record<string, string> {
  const couponCodes = input.couponCodes ?? (input.couponCode ? [input.couponCode] : []);
  const md: Record<string, string> = {
    kind: "deferred_checkout",
    shippingAddressId: input.shippingAddressId ?? "",
    couponCodes: couponCodes.join(","),
    useWalletBalance: input.useWalletBalance ? "1" : "0",
    settlementRiskAccepted: input.settlementRiskAccepted ? "1" : "0",
    acceptTerms: input.acceptTerms ? "1" : "0",
    acceptReturns: input.acceptReturns ? "1" : "0",
    acceptShipping: input.acceptShipping ? "1" : "0",
    idempotencyKey: input.idempotencyKey?.trim().slice(0, 120) || "",
    buyingForCompany: input.buyingForCompany ? "1" : "0",
    ...extra,
  };
  if (input.buyingForCompany) {
    md.companyName = (input.companyName ?? "").trim().slice(0, 200);
    md.companyTaxId = (input.companyTaxId ?? "").trim().slice(0, 64);
    md.companyCrNumber = (input.companyCrNumber ?? "").trim().slice(0, 64);
    md.companyHqAddressLine1 = (input.companyHqAddressLine1 ?? "").trim().slice(0, 200);
    md.companyHqCity = (input.companyHqCity ?? "").trim().slice(0, 100);
    md.companyHqCountryCode = (input.companyHqCountryCode ?? "").trim().toUpperCase().slice(0, 2);
  }
  return md;
}

/** Restore PlaceOrderInput from PSP charge/session metadata. */
export function unpackCheckoutIntentMetadata(
  metadata: Record<string, string> | null | undefined,
): {
  buyerUserId: string | null;
  marketId: string | null;
  input: PlaceOrderInput;
} {
  const md = metadata ?? {};
  const couponCodes = md.couponCodes
    ? md.couponCodes.split(",").map((c) => c.trim()).filter(Boolean)
    : null;
  const buyingForCompany = md.buyingForCompany === "1";
  return {
    buyerUserId: md.buyerUserId || null,
    marketId: md.marketId || null,
    input: {
      idempotencyKey: md.idempotencyKey || null,
      shippingAddressId: md.shippingAddressId || null,
      couponCodes: couponCodes && couponCodes.length > 0 ? couponCodes : null,
      useWalletBalance: md.useWalletBalance === "1",
      settlementRiskAccepted: md.settlementRiskAccepted === "1",
      acceptTerms: md.acceptTerms === "1",
      acceptReturns: md.acceptReturns === "1",
      acceptShipping: md.acceptShipping === "1",
      buyingForCompany,
      companyName: buyingForCompany ? md.companyName || null : null,
      companyTaxId: buyingForCompany ? md.companyTaxId || null : null,
      companyCrNumber: buyingForCompany ? md.companyCrNumber || null : null,
      companyHqAddressLine1: buyingForCompany ? md.companyHqAddressLine1 || null : null,
      companyHqCity: buyingForCompany ? md.companyHqCity || null : null,
      companyHqCountryCode: buyingForCompany ? md.companyHqCountryCode || null : null,
    },
  };
}
