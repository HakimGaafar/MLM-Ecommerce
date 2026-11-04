import { redirect } from "next/navigation";
import VendorOnboardingWizard from "@/app/sell/VendorOnboardingWizard";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getAppLocale } from "@/lib/ui-locale";
import { getActiveMarket } from "@/lib/market-server";
import { getServerSession } from "@/lib/server-session";
import { firstAllowedVendorHrefForUser } from "@/lib/vendor-access";
import { getVendorOnboardingState, resolveVendorAccessForUser } from "@mlm/domain";

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const locale = await getAppLocale();
  const ui = locale === "ar" ? ar.sellOnboarding : en.sellOnboarding;
  const internationalVendorUi =
    locale === "ar" ? ar.internationalNotices.vendor : en.internationalNotices.vendor;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const market = await getActiveMarket();

  const session = await getServerSession();
  let mode: "guest" | "loggedIn" = "guest";
  let initialStep = 1;
  let needsStoreBootstrap = false;

  if (session) {
    const access = await resolveVendorAccessForUser(session.sub, market.id);
    if (access) {
      const state = await getVendorOnboardingState(session.sub, market.id);
      if (state?.onboardingStatus === "ACTIVE" && state.storeApprovalStatus === "APPROVED") {
        const href = (await firstAllowedVendorHrefForUser(session.sub, market.id)) ?? "/vendor/products";
        redirect(href);
      }
      mode = "loggedIn";
      initialStep = state?.onboardingStep ?? 2;
    } else {
      mode = "loggedIn";
      needsStoreBootstrap = true;
      initialStep = 1;
    }
  }

  return (
    <PageShell dir={direction} maxWidth="3xl">
      <PageHeader
        title={mode === "loggedIn" ? ui.loggedInTitle : ui.title}
        subtitle={mode === "loggedIn" ? ui.loggedInSubtitle : ui.subtitle}
      />
      <VendorOnboardingWizard
        locale={locale}
        mode={mode}
        initialReferralCode={ref ?? ""}
        initialStep={initialStep}
        needsStoreBootstrap={needsStoreBootstrap}
        internationalNotice={market.code === "GLOBAL" ? internationalVendorUi : null}
      />
    </PageShell>
  );
}
