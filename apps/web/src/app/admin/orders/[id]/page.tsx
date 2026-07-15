import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import AdminOrderDetail from "./AdminOrderDetail";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminOrders;
  const status = dict.orderStatus;
  const direction = locale === "ar" ? "rtl" : "ltr";

  const statusLabels = {
    NEW: status.NEW,
    PROCESSING: status.PROCESSING,
    SHIPPED: status.SHIPPED,
    COMPLETED: status.COMPLETED,
    CANCELLED: status.CANCELLED,
  };

  const nextActionLabels = {
    PROCESSING: ui.nextActions.toProcessing,
    SHIPPED: ui.nextActions.toShipped,
    COMPLETED: ui.nextActions.toCompleted,
    CANCELLED: ui.nextActions.toCancelled,
  };

  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <h1 className="text-2xl font-semibold">{ui.detailTitle}</h1>
      <AdminOrderDetail
        orderId={id}
        locale={locale}
        ui={{
          ...ui.detail,
          statusLabels,
          nextActionLabels,
          unitStatusLabels: dict.orderUnitStatus as Record<string, string>,
        }}
        opsUi={{
          ...dict.adminOrderOps.panel,
          statusLabels,
        }}
      />
    </main>
  );
}
