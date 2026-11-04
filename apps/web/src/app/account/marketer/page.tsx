import { redirect } from "next/navigation";
import AccountAnnouncements from "@/components/account/AccountAnnouncements";
import AccountLandingLayout from "@/components/account/AccountLandingLayout";
import MarketerLoginPanel from "@/components/account/MarketerLoginPanel";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getRolesUserCanSwitch } from "@/lib/active-role";
import { getAppLocale } from "@/lib/ui-locale";
import { getServerSession } from "@/lib/server-session";

export default async function MarketerAccountPage() {
  const session = await getServerSession();
  if (session?.roles.includes("AFFILIATE") || session?.roles.includes("CUSTOMER")) {
    const canCustomer = getRolesUserCanSwitch(session.roles ?? []).includes("CUSTOMER");
    if (canCustomer) {
      // First-party redirect: enter-role GET sets httpOnly active-role cookie when Sec-Fetch-Site is not cross-site.
      redirect("/api/v1/auth/enter-role?role=CUSTOMER&to=/affiliate");
    }
    redirect("/affiliate");
  }

  const locale = await getAppLocale();
  const ui = locale === "ar" ? ar.accountPortal.marketer : en.accountPortal.marketer;

  return (
    <AccountLandingLayout
      title={ui.pageTitle}
      subtitle={ui.pageSubtitle}
      announcements={<AccountAnnouncements audience="marketer" />}
    >
      <MarketerLoginPanel />
    </AccountLandingLayout>
  );
}
