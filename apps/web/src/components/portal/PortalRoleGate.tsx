import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";

type GateKey =
  | "cart"
  | "checkout"
  | "orders"
  | "ordersDetail"
  | "profile"
  | "returns"
  | "returnsDetail"
  | "affiliate"
  | "cashback";

export default async function PortalRoleGate({ page }: { page: GateKey }) {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.portalRoleGate[page];
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter" dir={direction}>
      <h1 className="text-2xl font-semibold">{ui.title}</h1>
      <p className="mt-3 text-[var(--muted)]">{ui.body}</p>
    </main>
  );
}
