import Link from "next/link";
import { vendorHasPermission } from "@mlm/shared";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getVendorPermissionsForUser } from "@/lib/vendor-access";
import { getServerSession } from "@/lib/server-session";
import VendorTeamManager from "./VendorTeamManager";

export default async function VendorTeamPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.vendorTeam;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const session = await getServerSession();
  const permissions = session?.sub ? await getVendorPermissionsForUser(session.sub) : [];
  const canEdit = vendorHasPermission(permissions, "vendor:team:edit");

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
      <div className="mt-8">
        <VendorTeamManager locale={locale} ui={ui} canEdit={canEdit} />
      </div>
    </main>
  );
}
