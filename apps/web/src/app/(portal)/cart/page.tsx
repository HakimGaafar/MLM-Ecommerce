import { cookies } from "next/headers";
import CustomerCartPage from "@/app/customer/cart/page";
import PortalRoleGate from "@/components/portal/PortalRoleGate";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import { getServerSession } from "@/lib/server-session";

export default async function CartPage() {
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role === "CUSTOMER") return <CustomerCartPage />;
  return <PortalRoleGate page="cart" />;
}
