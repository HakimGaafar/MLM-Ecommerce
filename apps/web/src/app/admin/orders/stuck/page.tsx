import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import AdminStuckOrdersList from "./AdminStuckOrdersList";

export default async function AdminStuckOrdersPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminOrderOps.stuckList;
  const status = dict.orderStatus;
  const fulfillmentDict = {
    fulfillmentDirect: dict.customerOrderDetail.fulfillmentDirect,
    fulfillmentWarehouseA: dict.customerOrderDetail.fulfillmentWarehouseA,
    fulfillmentWarehouseB: dict.customerOrderDetail.fulfillmentWarehouseB,
  };

  return (
    <AdminStuckOrdersList
      locale={locale}
      ui={{
        ...ui,
        statusLabels: {
          NEW: status.NEW,
          PROCESSING: status.PROCESSING,
          SHIPPED: status.SHIPPED,
          COMPLETED: status.COMPLETED,
          CANCELLED: status.CANCELLED,
        },
        fulfillmentDict,
      }}
    />
  );
}
