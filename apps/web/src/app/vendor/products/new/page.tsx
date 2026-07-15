import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import VendorProductForm from "../VendorProductForm";
import VendorProductPageChrome from "../VendorProductPageChrome";
import VendorProductPageLayout from "../VendorProductPageLayout";

export default async function VendorProductNewPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;

  return (
    <VendorProductPageLayout>
      <VendorProductPageChrome mode="create" />
      <VendorProductForm />
    </VendorProductPageLayout>
  );
}
