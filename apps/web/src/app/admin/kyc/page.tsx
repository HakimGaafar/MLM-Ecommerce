import { PageHeader, PageShell } from "@/components/ui/PageShell";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import AdminKycGroupedList from "./AdminKycGroupedList";

export default async function AdminKycPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminKyc;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <PageShell dir={direction} maxWidth="5xl">
      <PageHeader title={ui.title} subtitle={ui.subtitle} />
      <AdminKycGroupedList
        locale={locale}
        ui={{
          ...ui.list,
          documentTypes: dict.kyc.documentTypes,
          statusLabels: dict.kyc.statusLabels,
          subjectTypes: ui.subjectTypes,
        }}
      />
    </PageShell>
  );
}
