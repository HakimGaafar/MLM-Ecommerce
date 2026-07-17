import { redirect } from "next/navigation";
import {
  hasAcceptedInternationalSalesAgreement,
  resolveVendorAccessForUser,
} from "@mlm/domain";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getActiveMarket } from "@/lib/market-server";
import { requirePageAuth } from "@/lib/require-page-auth";
import { firstAllowedVendorHrefForUser, getVendorPermissionsForUser } from "@/lib/vendor-access";
import VendorLayoutGuard from "./VendorLayoutGuard";
import VendorInternationalConsentGate from "./VendorInternationalConsentGate";

export default async function VendorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requirePageAuth("VENDOR");
  const market = await getActiveMarket();

  const access = await resolveVendorAccessForUser(session.sub, market.id);
  if (!access) redirect("/sell");

  const permissions = await getVendorPermissionsForUser(session.sub, market.id);
  const fallbackHref = (await firstAllowedVendorHrefForUser(session.sub, market.id)) ?? "/sell";
  const locale = await getCustomerPreferredLocale();
  const denied = locale === "ar" ? ar.vendorAccess : en.vendorAccess;
  const internationalNotice =
    locale === "ar" ? ar.internationalNotices.vendor : en.internationalNotices.vendor;
  const requiresInternationalConsent =
    market.code === "GLOBAL" &&
    !(await hasAcceptedInternationalSalesAgreement(access.vendorId));

  return (
    <VendorInternationalConsentGate
      notice={requiresInternationalConsent ? internationalNotice : null}
      canAccept={access.isOwner}
    >
      <VendorLayoutGuard
        permissions={permissions}
        fallbackHref={fallbackHref}
        deniedTitle={denied.title}
        deniedBody={denied.body}
        deniedLinkLabel={denied.goToAllowed}
      >
        {children}
      </VendorLayoutGuard>
    </VendorInternationalConsentGate>
  );
}
