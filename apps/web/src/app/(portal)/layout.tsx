import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { requirePageAuth } from "@/lib/require-page-auth";

/** Phase IX1: shared account canvas for customer portal routes. */
export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requirePageAuth("CUSTOMER");

  const cookieStore = await cookies();
  const role = resolveActiveRole(session.roles ?? [], cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  if (role !== "CUSTOMER") {
    redirect("/dashboard");
  }

  const locale = await getCustomerPreferredLocale();
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <div className="portal-account min-h-0 flex-1" dir={direction} data-portal-account>
      {children}
    </div>
  );
}
