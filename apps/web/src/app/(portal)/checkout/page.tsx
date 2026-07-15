import { cookies } from "next/headers";
import CustomerCheckoutPage from "@/app/customer/checkout/page";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import { getServerSession } from "@/lib/server-session";

export default async function CheckoutPage() {
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role === "CUSTOMER") return <CustomerCheckoutPage />;

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter">
      <h1 className="text-2xl font-semibold">Checkout</h1>
      <p className="mt-3 text-[var(--muted)]">Checkout is only available for customer accounts.</p>
    </main>
  );
}
