import { redirect } from "next/navigation";
import AccountAnnouncements from "@/components/account/AccountAnnouncements";
import AccountLandingLayout from "@/components/account/AccountLandingLayout";
import MarketerLoginPanel from "@/components/account/MarketerLoginPanel";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getAppLocale } from "@/lib/ui-locale";
import { getServerSession } from "@/lib/server-session";

export default async function MarketerAccountPage() {
  const session = await getServerSession();
  if (session?.roles.includes("AFFILIATE")) {
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
