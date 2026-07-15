import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import ProductsCatalog from "@/components/catalog/ProductsCatalog";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getAppLocale } from "@/lib/ui-locale";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { categoryId } = await searchParams;
  const locale = await getAppLocale();
  const ui = locale === "ar" ? ar.productCatalog : en.productCatalog;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <PageShell dir={direction}>
      <PageHeader title={ui.title} subtitle={ui.subtitle} />
      <ProductsCatalog locale={locale} ui={ui} initialCategoryId={categoryId ?? null} />
    </PageShell>
  );
}
