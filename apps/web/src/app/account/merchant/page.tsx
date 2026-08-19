import { redirect } from "next/navigation";
import AccountAnnouncements from "@/components/account/AccountAnnouncements";
import AccountLandingLayout from "@/components/account/AccountLandingLayout";
import MerchantLoginPanel from "@/components/account/MerchantLoginPanel";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getAppLocale } from "@/lib/ui-locale";
import { getServerSession } from "@/lib/server-session";

export default async function MerchantAccountPage() {
  const session = await getServerSession();
  if (session?.roles.includes("VENDOR")) {
    redirect("/vendor");
  }

  const locale = await getAppLocale();
  const ui = locale === "ar" ? ar.accountPortal.merchant : en.accountPortal.merchant;

  return (
    <AccountLandingLayout
      title={ui.pageTitle}
      subtitle={ui.pageSubtitle}
      announcements={<AccountAnnouncements audience="merchant" />}
    >
      <MerchantLoginPanel />
    </AccountLandingLayout>
  );
}
