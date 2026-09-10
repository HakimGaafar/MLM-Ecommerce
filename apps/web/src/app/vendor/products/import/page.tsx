import Link from "next/link";
import { vendorHasPermission } from "@mlm/shared";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import VendorMerchantGateNotice from "../../VendorMerchantGateNotice";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getCurrentVendorMerchantReadiness } from "@/lib/vendor-merchant-readiness";
import { getVendorPermissionsForOwner } from "@/lib/vendor-access";
import { getServerSession } from "@/lib/server-session";
import VendorProductImportForm from "./VendorProductImportForm";

export default async function VendorProductImportPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.vendorProductImport;
  const productsUi = dict.vendorProducts;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const session = await getServerSession();
  const permissions = session?.sub ? await getVendorPermissionsForOwner(session.sub) : [];
  const canImport = vendorHasPermission(permissions, "vendor:products:write");
  const readiness = await getCurrentVendorMerchantReadiness();
  const canSell = readiness?.canSell === true;

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/vendor/products" className="text-sm text-link font-medium">
          {ui.backToProducts}
        </Link>
      </div>
      <div className="mt-8">
        {!canSell ? (
          <VendorMerchantGateNotice
            copy={{
              notActivatedTitle: productsUi.notActivatedTitle,
              notActivatedBody: productsUi.notActivatedBody,
              notActivatedCtaSetup: productsUi.notActivatedCtaSetup,
              notActivatedCtaKyc: productsUi.notActivatedCtaKyc,
              notActivatedCtaDashboard: productsUi.notActivatedCtaDashboard,
            }}
          />
        ) : canImport ? (
          <VendorProductImportForm locale={locale} ui={ui} />
        ) : (
          <p className="app-callout-warning px-4 py-3 text-sm">
            {productsUi.importNoPermission}
          </p>
        )}
      </div>
    </main>
  );
}
