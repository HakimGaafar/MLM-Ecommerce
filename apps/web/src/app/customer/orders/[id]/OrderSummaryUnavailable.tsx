import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/PageShell";

export default function OrderSummaryUnavailable({
  orderId,
  locale,
  title,
  message,
  backToOrder,
}: {
  orderId: string;
  locale: "en" | "ar";
  title: string;
  message: string;
  backToOrder: string;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <PageShell dir={direction} maxWidth="3xl">
      <PageHeader title={title} />
      <section className="app-card p-8 text-center">
        <p className="text-sm text-[var(--muted)]">{message}</p>
        <Link href={`/orders/${orderId}`} className="btn-secondary btn-press mt-6 inline-flex">
          {backToOrder}
        </Link>
      </section>
    </PageShell>
  );
}
