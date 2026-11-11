"use client";

import type { CustomerShippingAddressDto, MarketCode } from "@mlm/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import GoToMarketButton from "@/components/market/GoToMarketButton";
import OtpVerificationPanel from "@/components/auth/OtpVerificationPanel";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type CartLine = {
  itemId: string;
  productId: string;
  name: string;
  vendorName: string;
  unitPrice: string;
  currency: string;
  quantity: number;
  lineTotal: string;
};

type CartPayload = {
  items: CartLine[];
  subtotal: string;
  currency: string;
};

type QuoteCouponApplication = {
  couponId: string;
  vendorId: string;
  vendorName: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: string;
  discountAmount: string;
};

type QuoteCoupons = {
  codes: Array<{
    code: string;
    applications: QuoteCouponApplication[];
    discountTotal: string;
  }>;
  discountTotal: string;
};

type QuoteShippingLine = {
  vendorId: string;
  vendorName: string;
  fulfillmentType: string;
  shippingMode: string;
  indirectFulfillment: string | null;
  fee: string;
};

type QuoteVatLine = {
  kind: "VENDOR_GOODS" | "WAREHOUSE_SHIPPING";
  vendorId: string | null;
  label: string;
  taxableBase: string;
  vatRatePercent: number;
  vatAmount: string;
};

type QuotePayload = {
  cart: CartPayload;
  shippingFee: string;
  shippingBreakdown: QuoteShippingLine[];
  discountTotal: string;
  vatTotal: string;
  vatBreakdown?: QuoteVatLine[];
  displayVatPercent?: number | null;
  totalAmount: string;
  profileComplete: boolean;
  shippingAddresses: CustomerShippingAddressDto[];
  defaultShippingAddressId: string | null;
  suggestedShippingAddressId?: string | null;
  deliveryMismatchMarketCode?: string | null;
  coupons: QuoteCoupons | null;
  cardPaymentsEnabled?: boolean;
  activePaymentGateway?: "stripe" | "hyperpay" | "tap" | "myfatoorah";
  plannedPaymentGateways?: {
    tap: boolean;
    hyperpay: boolean;
    myfatoorah: boolean;
  };
  walletAvailableBalance?: string;
  walletAppliedAmount?: string;
  remainingAmount?: string;
  emailVerified?: boolean;
  deliveryIssues?: Array<{
    itemId: string;
    productId: string;
    productName: string;
    cities: string[];
    reason: "PRODUCT_SPECIFIC" | "VENDOR_SHIPPING";
  }>;
};

type OrderDetail = {
  id: string;
  orderNo: string;
};

type CheckoutUi = {
  loading: string;
  loadError: string;
  emptyCart: string;
  backToCart: string;
  continueShopping: string;
  title: string;
  subtitle: string;
  vendor: string;
  product: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  subtotal: string;
  shippingLine: string;
  vatLine: string;
  vatLineDynamic?: string;
  vatBreakdownVendor?: string;
  vatBreakdownWarehouse?: string;
  totalLine: string;
  shippingVatNote: string;
  b2bTitle?: string;
  b2bToggle?: string;
  b2bHint?: string;
  b2bCompanyName?: string;
  b2bTaxId?: string;
  b2bCrNumber?: string;
  b2bHqAddress?: string;
  b2bHqCity?: string;
  b2bHqCountry?: string;
  b2bCompanyRequired?: string;
  paymentTitle: string;
  paymentCod: string;
  paymentCodHint: string;
  paymentCard: string;
  paymentCardHint: string;
  paymentCoveredByWallet: string;
  paymentCoveredByWalletHint: string;
  payWithCard: string;
  redirectingToStripe: string;
  redirectingToPayment?: string;
  settlementRiskTitle?: string;
  settlementRiskCheckbox?: string;
  settlementRiskHint?: string;
  settlementRiskRequired?: string;
  policyConsentTitle?: string;
  acceptTermsPrefix?: string;
  acceptTermsLink?: string;
  acceptReturnsPrefix?: string;
  acceptReturnsLink?: string;
  acceptShippingPrefix?: string;
  acceptShippingLink?: string;
  policyConsentRequired?: string;
  gatewayPickerTitle: string;
  gatewayPickerSubtitle: string;
  gatewayStripe: string;
  gatewayStripeHint: string;
  gatewayTap: string;
  gatewayHyperPay: string;
  gatewayMyFatoorah: string;
  gatewayComingSoon: string;
  gatewayComingSoonHint: string;
  gatewayContinue: string;
  gatewayCancel: string;
  cancelledNote: string;
  profileIncomplete: string;
  completeProfileLink: string;
  placeOrder: string;
  placingOrder: string;
  placeOrderError: string;
  shipToTitle: string;
  shipToHint: string;
  manageAddressesLink: string;
  defaultBadge: string;
  couponTitle: string;
  couponPlaceholder: string;
  couponApply: string;
  couponApplying: string;
  couponRemove: string;
  couponApplied: string;
  couponAppliedMulti: string;
  couponAppliedVendorLine: string;
  couponInvalid: string;
  discountLine: string;
  walletTitle: string;
  walletUse: string;
  walletNoBalance: string;
  walletAvailableLine: string;
  walletAppliedLine: string;
  remainingDueLine: string;
  deliveryMismatchTitle: string;
  deliveryMismatchBody: string;
  deliveryMismatchSwitch: string;
  deliveryMismatchSwitchError: string;
  deliveryIssuesTitle: string;
  deliveryIssueProduct: string;
  deliveryIssueVendor: string;
  deliveryIssuesCheckoutBlocked: string;
  deliveryIssuesBackToCart: string;
  deliveryIssuesChangeAddress?: string;
};

export default function CheckoutView({
  locale,
  ui,
  otpUi,
  toastOrderPlaced,
  internationalNotice,
}: {
  locale: Locale;
  ui: CheckoutUi;
  otpUi: {
    shared: {
      sendCode: string;
      sending: string;
      codeLabel: string;
      codePlaceholder: string;
      verify: string;
      verifying: string;
      resent: string;
      sendError: string;
      verifyError: string;
      invalidCode: string;
      loading: string;
    };
    checkoutTitle: string;
    checkoutBody: string;
  };
  toastOrderPlaced: string;
  internationalNotice: { checkoutTitle: string; checkoutBody: string } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const cancelled = searchParams.get("cancelled") === "1";
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE_CARD">("COD");
  const [gatewayPickerOpen, setGatewayPickerOpen] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<"stripe" | "tap">("tap");
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [selectedShippingAddressId, setSelectedShippingAddressId] = useState<string | null>(null);
  const selectedShippingAddressIdRef = useRef<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCodes, setAppliedCouponCodes] = useState<string[]>([]);
  const appliedCouponCodesRef = useRef<string[]>([]);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [buyingForCompany, setBuyingForCompany] = useState(false);
  const [settlementRiskAccepted, setSettlementRiskAccepted] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptReturns, setAcceptReturns] = useState(false);
  const [acceptShipping, setAcceptShipping] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyTaxId, setCompanyTaxId] = useState("");
  const [companyCrNumber, setCompanyCrNumber] = useState("");
  const [companyHqAddressLine1, setCompanyHqAddressLine1] = useState("");
  const [companyHqCity, setCompanyHqCity] = useState("");
  const [companyHqCountryCode, setCompanyHqCountryCode] = useState("");

  function syncAppliedCouponCodes(codes: string[]) {
    appliedCouponCodesRef.current = codes;
    setAppliedCouponCodes(codes);
  }

  const loadQuote = useCallback(
    async (options?: {
      couponCodes?: string[] | null;
      useWalletBalance?: boolean;
      couponAction?: boolean;
      shippingAddressId?: string | null;
    }) => {
      const couponCodes =
        options?.couponCodes === undefined ? appliedCouponCodesRef.current : options.couponCodes ?? [];
      const useWallet = options?.useWalletBalance ?? useWalletBalance;
      const shipId =
        options?.shippingAddressId !== undefined
          ? options.shippingAddressId
          : selectedShippingAddressIdRef.current;
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (couponCodes.length > 0) params.set("couponCodes", couponCodes.join(","));
        if (useWallet) params.set("useWalletBalance", "1");
        if (shipId) params.set("shippingAddressId", shipId);
        const qs = params.toString();
        const res = await fetch(`/api/v1/customer/checkout/quote${qs ? `?${qs}` : ""}`, {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as
          | (QuotePayload & { error?: string })
          | null;
        if (!res.ok) {
          throw new Error(payload?.error ?? ui.loadError);
        }
        const q = payload as QuotePayload;
        setQuote(q);
        setEmailVerified(q.emailVerified !== false);
        if (q.coupons) {
          syncAppliedCouponCodes(q.coupons.codes.map((c) => c.code));
          setCouponInput("");
        } else if (couponCodes.length > 0) {
          syncAppliedCouponCodes([]);
          throw new Error(payload?.error ?? ui.couponInvalid);
        } else {
          syncAppliedCouponCodes([]);
        }
        setSelectedShippingAddressId((prev) => {
          const suggested = q.suggestedShippingAddressId ?? null;
          const userPicked =
            options?.shippingAddressId !== undefined
              ? options.shippingAddressId
              : prev && q.shippingAddresses.some((a) => a.id === prev)
                ? prev
                : null;
          const next = userPicked ?? suggested;
          selectedShippingAddressIdRef.current = next;
          return next;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : options?.couponAction ? ui.couponInvalid : ui.loadError;
        if (options?.couponAction) {
          // Coupon errors surface via toast only (no page-level banner).
          throw new Error(msg);
        }
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [ui.couponInvalid, ui.loadError, useWalletBalance],
  );

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const skipAddressQuoteReload = useRef(true);
  useEffect(() => {
    if (skipAddressQuoteReload.current) {
      skipAddressQuoteReload.current = false;
      return;
    }
    if (!selectedShippingAddressId) return;
    selectedShippingAddressIdRef.current = selectedShippingAddressId;
    void loadQuote({ shippingAddressId: selectedShippingAddressId });
  }, [selectedShippingAddressId, loadQuote]);

  const cardEnabled = quote?.cardPaymentsEnabled === true;
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (!cardEnabled && paymentMethod === "ONLINE_CARD") {
      setPaymentMethod("COD");
    }
  }, [cardEnabled, paymentMethod]);

  useEffect(() => {
    if (!gatewayPickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setGatewayPickerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [gatewayPickerOpen, submitting]);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    if (appliedCouponCodes.includes(code)) return;
    setApplyingCoupon(true);
    setError(null);
    try {
      await loadQuote({ couponCodes: [...appliedCouponCodes, code], useWalletBalance, couponAction: true });
      setCouponInput("");
      toast.success(toastDict.couponApplied);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.couponInvalid;
      toast.error(msg || toastDict.couponInvalid);
    } finally {
      setApplyingCoupon(false);
    }
  }

  async function removeCoupon() {
    setCouponInput("");
    setApplyingCoupon(true);
    try {
      await loadQuote({ couponCodes: [], useWalletBalance });
    } finally {
      setApplyingCoupon(false);
    }
  }

  async function removeCouponCode(code: string) {
    setCouponInput("");
    const next = appliedCouponCodes.filter((c) => c !== code);
    setApplyingCoupon(true);
    try {
      await loadQuote({ couponCodes: next, useWalletBalance });
    } finally {
      setApplyingCoupon(false);
    }
  }

  function checkoutBody() {
    const body: {
      idempotencyKey: string;
      shippingAddressId?: string;
      couponCodes?: string[];
      useWalletBalance?: boolean;
      buyingForCompany?: boolean;
      companyName?: string;
      companyTaxId?: string;
      companyCrNumber?: string;
      companyHqAddressLine1?: string;
      companyHqCity?: string;
      companyHqCountryCode?: string;
      settlementRiskAccepted?: boolean;
      acceptTerms?: true;
      acceptReturns?: true;
      acceptShipping?: true;
    } = { idempotencyKey };
    if (quote?.shippingAddresses?.length && selectedShippingAddressId) {
      body.shippingAddressId = selectedShippingAddressId;
    }
    if (appliedCouponCodes.length > 0) {
      body.couponCodes = appliedCouponCodes;
    }
    if (useWalletBalance) {
      body.useWalletBalance = true;
    }
    if (buyingForCompany) {
      body.buyingForCompany = true;
      body.companyName = companyName.trim();
      body.companyTaxId = companyTaxId.trim() || undefined;
      body.companyCrNumber = companyCrNumber.trim() || undefined;
      body.companyHqAddressLine1 = companyHqAddressLine1.trim() || undefined;
      body.companyHqCity = companyHqCity.trim() || undefined;
      body.companyHqCountryCode = companyHqCountryCode.trim().toUpperCase() || undefined;
    }
    if (settlementRiskAccepted) {
      body.settlementRiskAccepted = true;
    }
    if (acceptTerms) body.acceptTerms = true;
    if (acceptReturns) body.acceptReturns = true;
    if (acceptShipping) body.acceptShipping = true;
    return body;
  }

  async function startCardPayment() {
    setError(null);
    setSubmitting(true);
    setGatewayPickerOpen(false);
    try {
      const res = await fetch("/api/v1/customer/checkout/payment-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(checkoutBody()),
      });
      const payload = (await res.json().catch(() => null)) as
        | {
            checkoutUrl?: string | null;
            orderId?: string;
            paidWithoutGateway?: boolean;
            error?: string;
            code?: string;
          }
        | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? ui.placeOrderError);
      }
      if (payload?.paidWithoutGateway && payload.orderId) {
        toast.success(toastOrderPlaced);
        router.replace(`/orders/${payload.orderId}`);
        router.refresh();
        return;
      }
      if (!payload?.checkoutUrl) {
        throw new Error(payload?.error ?? ui.placeOrderError);
      }
      window.location.href = payload.checkoutUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.placeOrderError;
      setError(msg);
      toast.error(msg || toastDict.checkoutFailed);
      setSubmitting(false);
    }
  }

  async function placeOrder() {
    setError(null);
    if (paymentMethod === "ONLINE_CARD" && cardEnabled) {
      // Single live PSP (Tap default): pay immediately — no gateway picker.
      setSelectedGateway(quote?.activePaymentGateway === "stripe" ? "stripe" : "tap");
      await startCardPayment();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/customer/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...checkoutBody(), paymentMethod: "COD" }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { order?: OrderDetail; error?: string }
        | null;
      if (!res.ok || !payload?.order?.id) {
        throw new Error(payload?.error ?? ui.placeOrderError);
      }
      toast.success(toastOrderPlaced);
      router.replace(`/orders/${payload.order.id}`);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.placeOrderError;
      setError(msg);
      toast.error(msg || toastDict.checkoutFailed);
    } finally {
      setSubmitting(false);
    }
  }

  const cart = quote?.cart;
  const hasDiscount = quote != null && Number.parseFloat(quote.discountTotal) > 0;
  const walletAvailable = quote?.walletAvailableBalance ?? "0";
  const walletApplied = quote?.walletAppliedAmount ?? "0";
  const remainingAmount = quote?.remainingAmount ?? quote?.totalAmount ?? "0";
  const walletHasBalance = Number.parseFloat(walletAvailable) > 0;
  const fullyCoveredByWallet = useWalletBalance && Number.parseFloat(remainingAmount) <= 0;

  useEffect(() => {
    if (!walletHasBalance && useWalletBalance) {
      setUseWalletBalance(false);
      void loadQuote({ useWalletBalance: false });
    }
  }, [walletHasBalance, useWalletBalance, loadQuote]);

  if (loading && !quote) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error && !cart) {
    return <p className="app-alert-error">{error}</p>;
  }

  if (!cart?.items.length) {
    return (
      <div className="mt-6 space-y-4" dir={direction}>
        {error ? <p className="app-alert-error">{error}</p> : null}
        <p className="app-card px-6 py-10 text-center text-sm text-[var(--muted)]">{ui.emptyCart}</p>
        <Link href="/cart" className="text-sm font-medium text-[var(--primary)] hover:underline">
          {ui.backToCart}
        </Link>
      </div>
    );
  }

  const profileOk = quote?.profileComplete === true;
  const hasSavedAddresses = Boolean(quote?.shippingAddresses?.length);
  const addressOk = !hasSavedAddresses || Boolean(selectedShippingAddressId);
  const deliveryOk = !quote?.deliveryMismatchMarketCode;
  const verificationOk = emailVerified !== false;
  const cartDeliveryOk = (quote?.deliveryIssues?.length ?? 0) === 0;
  const b2bOk = !buyingForCompany || companyName.trim().length > 0;
  const settlementRiskOk = settlementRiskAccepted;
  const policyConsentOk = acceptTerms && acceptReturns && acceptShipping;
  const canSubmit =
    profileOk &&
    addressOk &&
    deliveryOk &&
    verificationOk &&
    cartDeliveryOk &&
    b2bOk &&
    settlementRiskOk &&
    policyConsentOk &&
    !submitting &&
    !applyingCoupon;

  return (
    <div className="mt-6 space-y-6 animate-page-enter" dir={direction}>
      {error ? <p className="app-alert-error">{error}</p> : null}
      {cancelled ? <p className="app-card px-4 py-3 text-sm text-[var(--muted)]">{ui.cancelledNote}</p> : null}

      {!profileOk ? (
        <div className="app-callout-warning px-4 py-3 text-sm">
          <p>{ui.profileIncomplete}</p>
          <Link href="/profile" className="mt-2 inline-block font-medium text-[var(--primary)] underline">
            {ui.completeProfileLink}
          </Link>
        </div>
      ) : null}

      {profileOk && hasSavedAddresses ? (
        <section id="checkout-ship-to" className="app-card p-4 scroll-mt-24">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{ui.shipToTitle}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{ui.shipToHint}</p>
          <ul className="mt-3 space-y-2">
            {quote!.shippingAddresses.map((addr) => (
              <li key={addr.id}>
                <label className="flex cursor-pointer gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
                  <input
                    type="radio"
                    name="shipTo"
                    checked={selectedShippingAddressId === addr.id}
                    onChange={() => setSelectedShippingAddressId(addr.id)}
                  />
                  <span>
                    <span className="font-medium text-[var(--foreground)]">
                      {addr.recipientName}
                      {addr.label ? <span className="text-[var(--muted)]"> · {addr.label}</span> : null}
                      {addr.isDefault ? (
                        <span className="ms-2 rounded-full bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] px-2 py-0.5 text-xs">
                          {ui.defaultBadge}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[var(--muted)]">{addr.phone}</span>
                    <span className="mt-0.5 block text-[var(--foreground)]">
                      {addr.addressLine1}
                      {addr.addressLine2 ? `, ${addr.addressLine2}` : ""} — {addr.city}, {addr.postalCode},{" "}
                      {addr.countryCode}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Link href="/profile" className="mt-3 inline-block text-sm font-medium text-[var(--primary)] underline">
            {ui.manageAddressesLink}
          </Link>
        </section>
      ) : null}

      {quote?.deliveryMismatchMarketCode ? (
        <div className="app-callout-warning space-y-3 px-4 py-3 text-sm">
          <p className="font-semibold text-[var(--foreground)]">{ui.deliveryMismatchTitle}</p>
          <p className="text-[var(--muted)]">{ui.deliveryMismatchBody}</p>
          <GoToMarketButton
            homeMarketCode={quote.deliveryMismatchMarketCode as MarketCode}
            returnTo="/checkout"
            label={ui.deliveryMismatchSwitch}
            switchError={ui.deliveryMismatchSwitchError}
          />
        </div>
      ) : null}

      <section className="app-card p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{ui.couponTitle}</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (applyingCoupon || !couponInput.trim()) return;
            void applyCoupon();
          }}
        >
          <input
            className="app-input min-w-[10rem] flex-1 uppercase"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            placeholder={ui.couponPlaceholder}
            disabled={applyingCoupon}
            maxLength={32}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn-secondary btn-press"
            disabled={!couponInput.trim() || applyingCoupon}
          >
            {applyingCoupon ? ui.couponApplying : ui.couponApply}
          </button>
        </form>
        {appliedCouponCodes.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {appliedCouponCodes.map((code) => (
              <li
                key={code}
                className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1"
              >
                <span className="font-mono">{code}</span>
                <button
                  type="button"
                  className="rounded-md border border-red-500/60 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-200 hover:bg-red-500/25 disabled:opacity-50"
                  disabled={applyingCoupon}
                  onClick={() => void removeCouponCode(code)}
                  aria-label={`${ui.couponRemove}: ${code}`}
                >
                  {ui.couponRemove}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {quote?.coupons ? (
          <div className="mt-2 space-y-2 text-sm text-[var(--muted)]">
            {quote.coupons.codes.map((c) => (
              <div key={c.code} className="space-y-1">
                <p>{ui.couponAppliedMulti.replace("{code}", c.code)}</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {c.applications.map((app) => (
                    <li key={app.couponId}>
                      {ui.couponAppliedVendorLine
                        .replace("{vendor}", app.vendorName)
                        .replace("{amount}", formatMoney(app.discountAmount, cart.currency, locale))}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="app-card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{ui.walletTitle}</h2>
        <label
          className={`flex items-center gap-3 rounded-lg border border-[var(--border)] p-3 text-sm ${
            walletHasBalance ? "cursor-pointer" : "cursor-not-allowed opacity-60"
          }`}
        >
          <input
            type="checkbox"
            checked={useWalletBalance}
            disabled={!walletHasBalance}
            onChange={(e) => {
              if (!walletHasBalance) return;
              setUseWalletBalance(e.target.checked);
            }}
          />
          <span>{ui.walletUse}</span>
        </label>
        {!walletHasBalance ? (
          <p className="text-xs text-[var(--muted)]">{ui.walletNoBalance}</p>
        ) : null}
        <div className="space-y-1 text-sm text-[var(--muted)]">
          <p>
            {ui.walletAvailableLine}: {formatMoney(walletAvailable, cart.currency, locale)}
          </p>
          {useWalletBalance ? (
            <p>
              {ui.walletAppliedLine}: -{formatMoney(walletApplied, cart.currency, locale)}
            </p>
          ) : null}
          <p>
            {ui.remainingDueLine}: {formatMoney(remainingAmount, cart.currency, locale)}
          </p>
        </div>
      </section>

      <div className="app-card overflow-x-auto">
        <table className="w-full min-w-[32rem] text-start text-sm">
          <thead className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--foreground)_4%,var(--surface))]">
            <tr>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">{ui.vendor}</th>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">{ui.product}</th>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">{ui.unitPrice}</th>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">{ui.quantity}</th>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">{ui.lineTotal}</th>
            </tr>
          </thead>
          <tbody>
            {cart.items.map((line) => (
              <tr key={line.itemId} className="border-b border-[var(--border)]">
                <td className="px-4 py-3 text-[var(--muted)]">{line.vendorName}</td>
                <td className="px-4 py-3 font-medium text-[var(--foreground)]">{line.name}</td>
                <td className="px-4 py-3 tabular-nums">{formatMoney(line.unitPrice, line.currency, locale)}</td>
                <td className="px-4 py-3 tabular-nums">{line.quantity}</td>
                <td className="px-4 py-3 tabular-nums font-medium">
                  {formatMoney(line.lineTotal, line.currency, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="app-card space-y-2 p-4 text-end text-sm tabular-nums">
        <div className="flex justify-between gap-4 font-medium">
          <dt className="text-start text-[var(--muted)]">{ui.subtotal}</dt>
          <dd className="text-[var(--foreground)]">{formatMoney(cart.subtotal, cart.currency, locale)}</dd>
        </div>
        {hasDiscount ? (
          <div className="flex justify-between gap-4 text-emerald-700 dark:text-emerald-400">
            <dt className="text-start">{ui.discountLine}</dt>
            <dd>-{formatMoney(quote!.discountTotal, cart.currency, locale)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-start text-[var(--muted)]">{ui.shippingLine}</dt>
          <dd>{quote ? formatMoney(quote.shippingFee, cart.currency, locale) : "—"}</dd>
        </div>
        {(quote?.shippingBreakdown?.length ?? 0) > 0 ? (
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            {quote!.shippingBreakdown.map((line) => (
              <li key={`${line.vendorId}-${line.fulfillmentType}`} className="flex justify-between gap-3">
                <span className="text-start">
                  {line.vendorName} · {line.fulfillmentType}
                </span>
                <span className="tabular-nums">
                  {formatMoney(line.fee, cart.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-start text-[var(--muted)]">
            {quote?.displayVatPercent != null && ui.vatLineDynamic
              ? ui.vatLineDynamic.replace("{percent}", String(quote.displayVatPercent))
              : ui.vatLine}
          </dt>
          <dd>{quote ? formatMoney(quote.vatTotal, cart.currency, locale) : "—"}</dd>
        </div>
        {(quote?.vatBreakdown?.length ?? 0) > 1 ||
        (quote?.vatBreakdown?.some((line) => line.vatRatePercent === 0) ?? false) ? (
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            {quote!.vatBreakdown!.map((line, idx) => (
              <li key={`${line.kind}-${line.vendorId ?? "wh"}-${idx}`} className="flex justify-between gap-3">
                <span className="text-start">
                  {line.kind === "WAREHOUSE_SHIPPING"
                    ? (ui.vatBreakdownWarehouse ?? line.label)
                    : `${ui.vatBreakdownVendor ?? "VAT"} · ${line.label} (${line.vatRatePercent}%)`}
                </span>
                <span className="tabular-nums">
                  {formatMoney(line.vatAmount, cart.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-2 text-base font-semibold">
          <dt className="text-start">{ui.totalLine}</dt>
          <dd>{quote ? formatMoney(quote.totalAmount, cart.currency, locale) : "—"}</dd>
        </div>
        {useWalletBalance ? (
          <>
            <div className="flex justify-between gap-4 text-emerald-700 dark:text-emerald-400">
              <dt className="text-start">{ui.walletAppliedLine}</dt>
              <dd>-{formatMoney(walletApplied, cart.currency, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-2 text-base font-semibold">
              <dt className="text-start">{ui.remainingDueLine}</dt>
              <dd>{formatMoney(remainingAmount, cart.currency, locale)}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <p className="text-sm text-[var(--muted)]">{ui.shippingVatNote}</p>

      <section className="app-card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {ui.b2bTitle ?? "Business purchase"}
        </h2>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={buyingForCompany}
            onChange={(e) => setBuyingForCompany(e.target.checked)}
          />
          <span>
            <span className="font-medium text-[var(--foreground)]">
              {ui.b2bToggle ?? "Buying for a company?"}
            </span>
            <span className="mt-1 block text-[var(--muted)]">
              {ui.b2bHint ?? "Company details appear on your order. Tax amount does not change."}
            </span>
          </span>
        </label>
        {buyingForCompany ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="font-medium">{ui.b2bCompanyName ?? "Company name"}</span>
              <input
                className="app-input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{ui.b2bTaxId ?? "Tax ID / TRN"}</span>
              <input
                className="app-input"
                value={companyTaxId}
                onChange={(e) => setCompanyTaxId(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{ui.b2bCrNumber ?? "Commercial registration"}</span>
              <input
                className="app-input"
                value={companyCrNumber}
                onChange={(e) => setCompanyCrNumber(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="font-medium">{ui.b2bHqAddress ?? "HQ address"}</span>
              <input
                className="app-input"
                value={companyHqAddressLine1}
                onChange={(e) => setCompanyHqAddressLine1(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{ui.b2bHqCity ?? "HQ city"}</span>
              <input
                className="app-input"
                value={companyHqCity}
                onChange={(e) => setCompanyHqCity(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{ui.b2bHqCountry ?? "HQ country (ISO)"}</span>
              <input
                className="app-input uppercase"
                maxLength={2}
                value={companyHqCountryCode}
                onChange={(e) => setCompanyHqCountryCode(e.target.value.toUpperCase())}
              />
            </label>
            {!b2bOk ? (
              <p className="text-xs text-amber-700 dark:text-amber-400 sm:col-span-2">
                {ui.b2bCompanyRequired ?? "Company name is required."}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="app-card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {ui.policyConsentTitle ?? "Policies"}
        </h2>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
          />
          <span>
            {ui.acceptTermsPrefix ?? "I agree to the"}{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-link underline">
              {ui.acceptTermsLink ?? "Terms & Conditions"}
            </a>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={acceptReturns}
            onChange={(e) => setAcceptReturns(e.target.checked)}
          />
          <span>
            {ui.acceptReturnsPrefix ?? "I agree to the"}{" "}
            <a href="/returns-policy" target="_blank" rel="noopener noreferrer" className="text-link underline">
              {ui.acceptReturnsLink ?? "Returns policy"}
            </a>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={acceptShipping}
            onChange={(e) => setAcceptShipping(e.target.checked)}
          />
          <span>
            {ui.acceptShippingPrefix ?? "I agree to the"}{" "}
            <a href="/shipping-policy" target="_blank" rel="noopener noreferrer" className="text-link underline">
              {ui.acceptShippingLink ?? "Shipping policy"}
            </a>
          </span>
        </label>
        {!policyConsentOk ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {ui.policyConsentRequired ?? "Accept Terms, Returns, and Shipping to continue."}
          </p>
        ) : null}
      </section>

      <section className="app-card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {ui.settlementRiskTitle}
        </h2>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={settlementRiskAccepted}
            onChange={(e) => setSettlementRiskAccepted(e.target.checked)}
          />
          <span>
            <span className="font-medium text-[var(--foreground)]">
              {ui.settlementRiskCheckbox}
            </span>
            <span className="mt-1 block text-[var(--muted)]">
              {ui.settlementRiskHint}
            </span>
          </span>
        </label>
        {!settlementRiskOk ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {ui.settlementRiskRequired}
          </p>
        ) : null}
      </section>

      <section className="app-card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{ui.paymentTitle}</h2>
        {fullyCoveredByWallet ? (
          <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
            <p className="font-medium text-[var(--foreground)]">{ui.paymentCoveredByWallet}</p>
            <p className="mt-1 text-[var(--muted)]">{ui.paymentCoveredByWalletHint}</p>
          </div>
        ) : (
          <>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-[var(--border)] p-3 text-sm">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === "COD"}
                onChange={() => setPaymentMethod("COD")}
              />
              <span>
                <span className="font-medium text-[var(--foreground)]">{ui.paymentCod}</span>
                <span className="mt-1 block text-[var(--muted)]">{ui.paymentCodHint}</span>
              </span>
            </label>
            {cardEnabled ? (
              <label className="flex cursor-pointer gap-3 rounded-lg border border-[var(--border)] p-3 text-sm">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "ONLINE_CARD"}
                  onChange={() => setPaymentMethod("ONLINE_CARD")}
                />
                <span>
                  <span className="font-medium text-[var(--foreground)]">{ui.paymentCard}</span>
                  <span className="mt-1 block text-[var(--muted)]">{ui.paymentCardHint}</span>
                </span>
              </label>
            ) : null}
          </>
        )}
      </section>

      {internationalNotice ? (
        <section className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-4 text-sm">
          <h2 className="font-semibold text-[var(--foreground)]">
            {internationalNotice.checkoutTitle}
          </h2>
          <p className="mt-1 leading-6 text-[var(--muted)]">
            {internationalNotice.checkoutBody}
          </p>
        </section>
      ) : null}

      {(quote?.deliveryIssues?.length ?? 0) > 0 ? (
        <section className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <h2 className="font-semibold text-[var(--foreground)]">{ui.deliveryIssuesTitle}</h2>
          <ul className="mt-3 space-y-2">
            {quote!.deliveryIssues!.map((issue) => (
              <li key={issue.itemId} className="text-[var(--foreground)]">
                <span className="font-medium">{issue.productName}</span>
                <span className="text-[var(--muted)]">
                  {" — "}
                  {issue.reason === "PRODUCT_SPECIFIC"
                    ? ui.deliveryIssueProduct.replace(
                        "{cities}",
                        issue.cities.length > 0 ? issue.cities.join(", ") : "—",
                      )
                    : ui.deliveryIssueVendor}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[var(--muted)]">{ui.deliveryIssuesCheckoutBlocked}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary btn-press inline-flex text-sm"
              onClick={() => {
                document.getElementById("checkout-ship-to")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {ui.deliveryIssuesChangeAddress ?? "Change delivery address"}
            </button>
            <Link href="/cart" className="btn-secondary btn-press inline-flex text-sm">
              {ui.deliveryIssuesBackToCart}
            </Link>
          </div>
        </section>
      ) : null}

      {emailVerified === false ? (
        <OtpVerificationPanel
          ui={otpUi.shared}
          title={otpUi.checkoutTitle}
          body={otpUi.checkoutBody}
          onVerified={() => {
            setEmailVerified(true);
            void loadQuote();
          }}
        />
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!canSubmit} onClick={() => void placeOrder()} className="btn-primary btn-press">
          {submitting
            ? fullyCoveredByWallet
              ? ui.placingOrder
              : paymentMethod === "ONLINE_CARD"
              ? (ui.redirectingToPayment ?? ui.redirectingToStripe)
              : ui.placingOrder
            : fullyCoveredByWallet
              ? ui.placeOrder
              : paymentMethod === "ONLINE_CARD"
              ? ui.payWithCard
              : ui.placeOrder}
        </button>
        <Link href="/cart" className="btn-secondary">
          {ui.backToCart}
        </Link>
        <Link
          href="/products"
          className="inline-flex items-center text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
        >
          {ui.continueShopping}
        </Link>
      </div>

      {gatewayPickerOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-9999 grid min-h-dvh place-items-center overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-[2px] sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payment-gateway-picker-title"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !submitting) {
                  setGatewayPickerOpen(false);
                }
              }}
            >
              <section
                className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] shadow-[0_24px_80px_rgba(0,0,0,0.35)] ring-1 ring-black/5 dark:border-white/10 dark:ring-white/5"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="h-1.5 bg-linear-to-r from-violet-500 via-indigo-500 to-sky-400" />
                <div className="p-5 sm:p-7">
                  <div className="flex items-start gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-violet-500/20 to-sky-400/20 text-primary ring-1 ring-primary/20">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden
                      >
                        <rect x="3" y="5" width="18" height="14" rx="3" />
                        <path d="M3 10h18M7 15h3" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="payment-gateway-picker-title"
                        className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
                      >
                        {ui.gatewayPickerTitle}
                      </h2>
                      <p className="mt-1.5 text-sm leading-6 text-(--muted)">
                        {ui.gatewayPickerSubtitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setGatewayPickerOpen(false)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-(--muted) transition hover:bg-black/5 hover:text-foreground disabled:opacity-40 dark:hover:bg-white/10"
                      aria-label={ui.gatewayCancel}
                    >
                      <span aria-hidden className="text-xl leading-none">×</span>
                    </button>
                  </div>

                  <div className="mt-6 space-y-2.5">
                    {quote?.activePaymentGateway === "tap" || !quote?.activePaymentGateway ? (
                      <label className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-primary/60 bg-primary/8 p-4 shadow-sm ring-1 ring-primary/15 transition hover:border-primary hover:bg-primary/12">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-sm">
                          T
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground">{ui.gatewayTap}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-(--muted)">
                            {ui.gatewayStripeHint}
                          </span>
                        </span>
                        <input
                          type="radio"
                          name="paymentGateway"
                          checked={selectedGateway === "tap"}
                          onChange={() => setSelectedGateway("tap")}
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                    ) : (
                      <label className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-primary/60 bg-primary/8 p-4 shadow-sm ring-1 ring-primary/15 transition hover:border-primary hover:bg-primary/12">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#635bff] text-sm font-bold text-white shadow-sm">
                          S
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground">{ui.gatewayStripe}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-(--muted)">
                            {ui.gatewayStripeHint}
                          </span>
                        </span>
                        <input
                          type="radio"
                          name="paymentGateway"
                          checked={selectedGateway === "stripe"}
                          onChange={() => setSelectedGateway("stripe")}
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                    )}

                    {(
                      [
                        {
                          id: "tap" as const,
                          label: ui.gatewayTap,
                          mark: "T",
                          visible:
                            (quote?.plannedPaymentGateways?.tap ?? true) &&
                            quote?.activePaymentGateway === "stripe",
                        },
                        {
                          id: "hyperpay" as const,
                          label: ui.gatewayHyperPay,
                          mark: "H",
                          visible: quote?.plannedPaymentGateways?.hyperpay ?? true,
                        },
                        {
                          id: "myfatoorah" as const,
                          label: ui.gatewayMyFatoorah,
                          mark: "M",
                          visible: quote?.plannedPaymentGateways?.myfatoorah ?? true,
                        },
                      ] as const
                    )
                      .filter((gateway) => gateway.visible)
                      .map((gateway) => (
                        <div
                          key={gateway.id}
                          title={ui.gatewayComingSoonHint}
                          className="flex cursor-not-allowed items-center gap-4 rounded-2xl border border-border/80 bg-black/1.5 p-4 opacity-65 dark:bg-white/2.5"
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/5 text-sm font-bold text-(--muted) dark:bg-white/10">
                            {gateway.mark}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-foreground">{gateway.label}</span>
                              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                {ui.gatewayComingSoon}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-xs leading-5 text-(--muted)">
                              {ui.gatewayComingSoonHint}
                            </span>
                          </span>
                          <span className="h-4 w-4 shrink-0 rounded-full border-2 border-border" />
                        </div>
                      ))}
                  </div>

                  <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border/70 pt-5 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      className="btn-secondary justify-center sm:min-w-24"
                      disabled={submitting}
                      onClick={() => setGatewayPickerOpen(false)}
                    >
                      {ui.gatewayCancel}
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-press justify-center sm:min-w-44"
                      disabled={submitting}
                      onClick={() => void startCardPayment()}
                    >
                      {submitting
                        ? (ui.redirectingToPayment ?? ui.redirectingToStripe)
                        : ui.gatewayContinue}
                    </button>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
