import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getCurrentVendorMerchantReadiness } from "@/lib/vendor-merchant-readiness";
import VendorMerchantGateNotice from "../../VendorMerchantGateNotice";
import VendorProductForm from "../VendorProductForm";
import VendorProductPageChrome from "../VendorProductPageChrome";
import VendorProductPageLayout from "../VendorProductPageLayout";

export default async function VendorProductNewPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const readiness = await getCurrentVendorMerchantReadiness();
  const canSell = readiness?.canSell === true;
  const gate = dict.vendorProducts;

  if (!canSell) {
    return (
      <VendorProductPageLayout>
        <VendorProductPageChrome mode="create" />
        <div className="mt-6">
          <VendorMerchantGateNotice
            copy={{
              notActivatedTitle: gate.notActivatedTitle,
              notActivatedBody: gate.notActivatedBody,
              notActivatedCtaSetup: gate.notActivatedCtaSetup,
              notActivatedCtaKyc: gate.notActivatedCtaKyc,
              notActivatedCtaDashboard: gate.notActivatedCtaDashboard,
            }}
          />
        </div>
      </VendorProductPageLayout>
    );
  }

  return (
    <VendorProductPageLayout>
      <VendorProductPageChrome mode="create" />
      <VendorProductForm />
    </VendorProductPageLayout>
  );
}
