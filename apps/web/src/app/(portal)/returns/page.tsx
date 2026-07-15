import { cookies } from "next/headers";
import CustomerReturnsPage from "@/app/customer/returns/page";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import { getServerSession } from "@/lib/server-session";

export default async function ReturnsListPage() {
  const session = await getServerSession();
  const cookieStore = await cookies();
  const role = resolveActiveRole(session?.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role === "CUSTOMER") return <CustomerReturnsPage />;

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter">
      <h1 className="text-2xl font-semibold">Returns</h1>
      <p className="mt-3 text-[var(--muted)]">Returns for this role are not implemented yet.</p>
    </main>
  );
}
