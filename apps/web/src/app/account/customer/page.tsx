import { redirect } from "next/navigation";
import { Suspense } from "react";
import AccountAnnouncements from "@/components/account/AccountAnnouncements";
import AccountLandingLayout from "@/components/account/AccountLandingLayout";
import CustomerAccountPanel from "@/components/account/CustomerAccountPanel";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getAppLocale } from "@/lib/ui-locale";
import { getServerSession } from "@/lib/server-session";

export default async function CustomerAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const session = await getServerSession();
  if (session?.roles.includes("CUSTOMER")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const locale = await getAppLocale();
  const ui = locale === "ar" ? ar.accountPortal.customer : en.accountPortal.customer;

  return (
    <AccountLandingLayout
      title={ui.pageTitle}
      subtitle={ui.pageSubtitle}
      announcements={<AccountAnnouncements audience="customer" />}
    >
      <Suspense fallback={<div className="app-card p-6 text-sm text-[var(--muted)]">{ui.loading}</div>}>
        <CustomerAccountPanel initialLocale={locale} initialReferralCode={params.ref} />
      </Suspense>
    </AccountLandingLayout>
  );
}
