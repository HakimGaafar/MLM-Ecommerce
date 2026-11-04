"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function VendorPayoutMissingInvoicesBanner({
  message,
  linkLabel,
}: {
  message: string;
  linkLabel: string;
}) {
  const [missingCount, setMissingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/vendor/payout-invoices", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          items?: Array<{ hasInvoice?: boolean }>;
        };
        const missing = (data.items ?? []).filter((i) => !i.hasInvoice).length;
        if (!cancelled) setMissingCount(missing);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (missingCount <= 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
      <p>
        {message} ({missingCount})
      </p>
      <Link href="/vendor/payout/invoices" className="mt-2 inline-flex text-link font-medium">
        {linkLabel}
      </Link>
    </div>
  );
}
