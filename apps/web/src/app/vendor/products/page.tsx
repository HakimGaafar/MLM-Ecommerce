import Link from "next/link";
import { vendorHasPermission } from "@mlm/shared";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getVendorPermissionsForOwner } from "@/lib/vendor-access";
import { getServerSession } from "@/lib/server-session";
import VendorProductsList from "./VendorProductsList";

export default async function VendorProductsPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.vendorProducts;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const session = await getServerSession();
  const permissions = session?.sub ? await getVendorPermissionsForOwner(session.sub) : [];
  const canDelete = vendorHasPermission(permissions, "vendor:products:delete");
  const canImport = vendorHasPermission(permissions, "vendor:products:write");

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
      <VendorProductsList
        canDelete={canDelete}
        canImport={canImport}
        ui={{
          loading: ui.loading,
          loadError: ui.loadError,
          empty: ui.empty,
          newProduct: ui.newProduct,
          importCsv: ui.importCsv,
          edit: ui.edit,
          name: ui.tableName,
          category: ui.tableCategory,
          fulfillment: ui.tableFulfillment,
          image: ui.tableImage,
          price: ui.tablePrice,
          status: ui.tableStatus,
          tabAll: ui.tabAll,
          tabDraft: ui.tabDraft,
          tabPending: ui.tabPending,
          tabPublished: ui.tabPublished,
          tabOnHold: ui.tabOnHold,
          submitForReview: ui.submitForReview,
          putOnHold: ui.putOnHold,
          statusDraft: ui.statusDraft,
          statusPending: ui.statusPending,
          statusPublished: ui.statusPublished,
          statusOnHold: ui.statusOnHold,
          statusRejected: ui.statusRejected,
          rejectedNote: ui.rejectedNote,
          editPendingNote: ui.editPendingNote,
          editRejectedReasonLabel: ui.editRejectedReasonLabel,
          productRejectedReasonLabel: ui.productRejectedReasonLabel,
          newProductsDraft: ui.newProductsDraft,
          tabRejected: ui.tabRejected,
          delete: ui.delete,
          deleteDialogTitle: ui.deleteDialogTitle,
          deleteConfirm: ui.deleteConfirm,
          deleteDialogConfirm: ui.deleteDialogConfirm,
          deleteDialogCancel: ui.deleteDialogCancel,
          deleting: ui.deleting,
          deleteErrorPublished: ui.deleteErrorPublished,
          deleteErrorOrders: ui.deleteErrorOrders,
        }}
      />
    </main>
  );
}
