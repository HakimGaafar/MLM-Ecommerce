import type { CustomerOrderShippingSnapshotDto } from "@mlm/domain";

type Locale = "en" | "ar";

export default function OrderDeliveryAddressCard({
  shipping,
  locale,
  title,
  legacyMessage,
  recipientLabel,
}: {
  shipping: CustomerOrderShippingSnapshotDto | null;
  locale: Locale;
  title: string;
  legacyMessage: string;
  recipientLabel: string;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <section className="app-card p-6" dir={direction}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h2>

      {!shipping ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{legacyMessage}</p>
      ) : (
        <div className="mt-4 flex gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.75">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z"
              />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{recipientLabel}</p>
            <p className="mt-1 text-base font-semibold text-[var(--foreground)]">{shipping.recipientName}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">
              {shipping.addressLine1}
              {shipping.addressLine2 ? (
                <>
                  <br />
                  {shipping.addressLine2}
                </>
              ) : null}
              <br />
              {shipping.city}
              {shipping.postalCode ? `, ${shipping.postalCode}` : ""}
              <br />
              {shipping.countryCode}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]" dir="ltr">
              {shipping.phone}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
