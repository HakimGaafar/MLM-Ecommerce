import { cookies } from "next/headers";
import CustomerReturnsPage from "@/app/customer/returns/page";
import PortalRoleGate from "@/components/portal/PortalRoleGate";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import { getServerSession } from "@/lib/server-session";

export default async function ReturnsListPage() {
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role === "CUSTOMER") return <CustomerReturnsPage />;
  return <PortalRoleGate page="returns" />;
}
