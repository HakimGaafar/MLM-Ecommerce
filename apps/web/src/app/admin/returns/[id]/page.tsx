import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import AdminReturnDetail from "./AdminReturnDetail";

export default async function AdminReturnDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminReturns;
  const orderStatus = dict.orderStatus;
  const returnStatus = dict.orderReturnStatus;
  const reasonLabels = dict.orderReturnReason as Record<string, string>;
  const direction = locale === "ar" ? "rtl" : "ltr";

  const orderStatusLabels = {
    NEW: orderStatus.NEW,
    PROCESSING: orderStatus.PROCESSING,
    SHIPPED: orderStatus.SHIPPED,
    COMPLETED: orderStatus.COMPLETED,
    CANCELLED: orderStatus.CANCELLED,
  };

  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <h1 className="text-2xl font-semibold">{ui.detailTitle}</h1>
      <AdminReturnDetail
        returnId={id}
        locale={locale}
        ui={{
          ...ui.detail,
          orderStatusLabels,
          returnStatusLabels: returnStatus as Record<string, string>,
          reasonLabels,
        }}
      />
    </main>
  );
}
