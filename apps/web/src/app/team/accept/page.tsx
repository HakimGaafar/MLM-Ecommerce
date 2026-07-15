import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import AcceptTeamInvite from "./AcceptTeamInvite";

export default async function AcceptTeamInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.teamAccept;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-lg p-8 animate-page-enter" dir={direction}>
      <h1 className="text-2xl font-semibold">{ui.title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
      <div className="mt-8">
        <AcceptTeamInvite token={token ?? ""} locale={locale} ui={ui} />
      </div>
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="text-link font-medium">
          {ui.login}
        </Link>
      </p>
    </main>
  );
}
