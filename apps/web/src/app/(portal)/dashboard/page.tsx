import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { vendorHasPermission } from "@mlm/shared";
import { resolveVendorAccessForUser } from "@mlm/domain";
import AdminDashboardPage from "@/app/admin/page";
import CustomerDashboardPage from "@/app/customer/page";
import VendorDashboardPage from "@/app/vendor/page";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import { getActiveMarket } from "@/lib/market-server";
import { firstAllowedVendorHrefForUser, getVendorPermissionsForUser } from "@/lib/vendor-access";
import { getServerSession } from "@/lib/server-session";

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session?.sub) {
    redirect("/login");
  }
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role === "ADMIN") return <AdminDashboardPage />;
  if (role === "VENDOR" && session) {
    const market = await getActiveMarket();
    const access = await resolveVendorAccessForUser(session.sub, market.id);
    if (!access) redirect("/sell");
    const permissions = await getVendorPermissionsForUser(session.sub, market.id);
    if (!vendorHasPermission(permissions, "vendor:dashboard:read")) {
      const fallback = await firstAllowedVendorHrefForUser(session.sub, market.id);
      redirect(fallback ?? "/sell");
    }
    return <VendorDashboardPage />;
  }
  if (role === "CUSTOMER") return <CustomerDashboardPage />;

  redirect("/login");
}
