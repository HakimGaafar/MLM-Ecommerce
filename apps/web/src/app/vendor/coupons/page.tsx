import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import VendorMerchantGateNotice from "../VendorMerchantGateNotice";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getCurrentVendorMerchantReadiness } from "@/lib/vendor-merchant-readiness";
import VendorCouponsList from "./VendorCouponsList";

export default async function VendorCouponsPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.vendorCoupons;
  const productsUi = dict.vendorProducts;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const readiness = await getCurrentVendorMerchantReadiness();
  const canSell = readiness?.canSell === true;

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/dashboard" className="text-sm text-link font-medium">
          {ui.backToDashboard}
        </Link>
      </div>
      {!canSell ? (
        <div className="mt-6">
          <VendorMerchantGateNotice
            copy={{
              notActivatedTitle: productsUi.notActivatedTitle,
              notActivatedBody: productsUi.notActivatedBody,
              notActivatedCtaSetup: productsUi.notActivatedCtaSetup,
              notActivatedCtaKyc: productsUi.notActivatedCtaKyc,
              notActivatedCtaDashboard: productsUi.notActivatedCtaDashboard,
            }}
          />
        </div>
      ) : null}
      <div className="mt-8">
        <VendorCouponsList locale={locale} ui={ui} canCreate={canSell} />
      </div>
    </main>
  );
}
