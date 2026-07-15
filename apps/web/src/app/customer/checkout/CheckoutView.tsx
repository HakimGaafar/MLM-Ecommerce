"use client";

import type { CustomerShippingAddressDto, MarketCode } from "@mlm/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GoToMarketButton from "@/components/market/GoToMarketButton";
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

type QuotePayload = {
  cart: CartPayload;
  shippingFee: string;
  shippingBreakdown: QuoteShippingLine[];
  discountTotal: string;
  vatTotal: string;
  totalAmount: string;
  profileComplete: boolean;
  shippingAddresses: CustomerShippingAddressDto[];
  defaultShippingAddressId: string | null;
  suggestedShippingAddressId?: string | null;
  deliveryMismatchMarketCode?: string | null;
  coupons: QuoteCoupons | null;
  cardPaymentsEnabled?: boolean;
  walletAvailableBalance?: string;
  walletAppliedAmount?: string;
  remainingAmount?: string;
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
  totalLine: string;
  shippingVatNote: string;
  paymentTitle: string;
  paymentCod: string;
  paymentCodHint: string;
  paymentCard: string;
  paymentCardHint: string;
  paymentCoveredByWallet: string;
  paymentCoveredByWalletHint: string;
  payWithCard: string;
  redirectingToStripe: string;
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
};

export default function CheckoutView({
  locale,
  ui,
  toastOrderPlaced,
}: {
  locale: Locale;
  ui: CheckoutUi;
  toastOrderPlaced: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const cancelled = searchParams.get("cancelled") === "1";
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE_CARD">("COD");
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
    return body;
  }

  async function placeOrder() {
    setError(null);
    setSubmitting(true);
    try {
      if (paymentMethod === "ONLINE_CARD" && cardEnabled) {
        const res = await fetch("/api/v1/customer/checkout/stripe-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(checkoutBody()),
        });
        const payload = (await res.json().catch(() => null)) as
          | { checkoutUrl?: string | null; orderId?: string; paidWithoutStripe?: boolean; error?: string }
          | null;
        if (!res.ok) {
          throw new Error(payload?.error ?? ui.placeOrderError);
        }
        if (payload?.paidWithoutStripe && payload.orderId) {
          toast.success(toastOrderPlaced);
          router.replace(`/orders/${payload.orderId}`);
          router.refresh();
          return;
        }
        if (!payload?.checkoutUrl) {
          throw new Error(payload?.error ?? ui.placeOrderError);
        }
        window.location.href = payload.checkoutUrl;
        return;
      }

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
  const canSubmit = profileOk && addressOk && deliveryOk && !submitting && !applyingCoupon;

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
        <section className="app-card p-4">
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
        <div className="flex justify-between gap-4">
          <dt className="text-start text-[var(--muted)]">{ui.vatLine}</dt>
          <dd>{quote ? formatMoney(quote.vatTotal, cart.currency, locale) : "—"}</dd>
        </div>
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

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!canSubmit} onClick={() => void placeOrder()} className="btn-primary btn-press">
          {submitting
            ? fullyCoveredByWallet
              ? ui.placingOrder
              : paymentMethod === "ONLINE_CARD"
              ? ui.redirectingToStripe
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
    </div>
  );
}
