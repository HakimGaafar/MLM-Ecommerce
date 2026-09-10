import Link from "next/link";

export type VendorMerchantGateCopy = {
  notActivatedTitle: string;
  notActivatedBody: string;
  notActivatedCtaSetup: string;
  notActivatedCtaKyc: string;
  notActivatedCtaDashboard: string;
};

export default function VendorMerchantGateNotice({
  copy,
}: {
  copy: VendorMerchantGateCopy;
}) {
  return (
    <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
      <h2 className="text-base font-semibold text-[var(--foreground)]">{copy.notActivatedTitle}</h2>
      <p className="mt-2 leading-6 text-[var(--muted)]">{copy.notActivatedBody}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/vendor/setup" className="btn-primary btn-press text-sm">
          {copy.notActivatedCtaSetup}
        </Link>
        <Link href="/vendor/kyc" className="btn-secondary btn-press text-sm">
          {copy.notActivatedCtaKyc}
        </Link>
        <Link href="/dashboard" className="text-link text-sm font-medium">
          {copy.notActivatedCtaDashboard}
        </Link>
      </div>
    </section>
  );
}
