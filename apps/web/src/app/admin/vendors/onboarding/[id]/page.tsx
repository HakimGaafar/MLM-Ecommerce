import AdminOnboardingReview from "@/app/admin/vendors/onboarding/[id]/AdminOnboardingReview";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";

export default async function AdminVendorOnboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminVendorOnboarding;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter" dir={direction}>
      <h1 className="text-2xl font-semibold">{ui.reviewTitle}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{ui.reviewSubtitle}</p>
      <AdminOnboardingReview
        vendorId={id}
        locale={locale}
        ui={{
          loading: ui.loading,
          loadError: ui.loadError,
          back: ui.backToQueue,
          accept: ui.accept,
          needsFix: ui.needsFix,
          approve: ui.approve,
          reject: ui.reject,
          toastSaved: ui.toastSaved,
          toastApproved: ui.toastApproved,
          toastRejected: ui.toastRejected,
          notePlaceholder: ui.notePlaceholder,
          pendingProfileChanges: ui.pendingProfileChanges,
          vendorNoteLabel: ui.vendorNoteLabel,
          fieldStatus: ui.fieldStatus,
          fieldLabels: ui.fieldLabels,
        }}
      />
    </main>
  );
}
