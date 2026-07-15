import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import VendorProductForm from "../../VendorProductForm";
import VendorProductPageChrome from "../../VendorProductPageChrome";
import VendorProductPageLayout from "../../VendorProductPageLayout";

export default async function VendorProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;

  return (
    <VendorProductPageLayout>
      <VendorProductPageChrome mode="edit" />
      <VendorProductForm productId={id} />
    </VendorProductPageLayout>
  );
}
