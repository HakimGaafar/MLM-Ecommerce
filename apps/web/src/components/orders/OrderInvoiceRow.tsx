import Link from "next/link";

export default function OrderInvoiceRow({
  orderId,
  invoiceEligible,
  finalInvoiceAllowed,
  title,
  viewSummary,
  pendingMessage,
  notEligibleMessage,
}: {
  orderId: string;
  invoiceEligible: boolean;
  finalInvoiceAllowed: boolean;
  title: string;
  viewSummary: string;
  pendingMessage: string;
  notEligibleMessage: string;
}) {
  const available = invoiceEligible && finalInvoiceAllowed;
  const subtitle = !invoiceEligible
    ? notEligibleMessage
    : !finalInvoiceAllowed
      ? pendingMessage
      : viewSummary;

  const content = (
    <>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          available
            ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]"
            : "bg-[var(--table-head-bg)] text-[var(--muted)]"
        }`}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.75">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
          />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
      </div>
      {available ? (
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 shrink-0 text-[var(--muted)] rtl:rotate-180"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.24 4.24a.75.75 0 0 1 0 1.06l-4.24 4.24a.75.75 0 0 1-1.06-.02Z"
            clipRule="evenodd"
          />
        </svg>
      ) : null}
    </>
  );

  if (available) {
    return (
      <Link
        href={`/orders/${orderId}/invoice`}
        className="app-card flex items-center gap-4 p-4 transition hover:border-[var(--primary)] hover:shadow-[var(--shadow-md)]"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="app-card flex items-center gap-4 p-4 opacity-80" aria-disabled="true">
      {content}
    </div>
  );
}
