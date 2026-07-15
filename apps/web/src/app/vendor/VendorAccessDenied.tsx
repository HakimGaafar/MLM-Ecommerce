import Link from "next/link";

export default function VendorAccessDenied({
  fallbackHref,
  title,
  body,
  linkLabel,
}: {
  fallbackHref: string;
  title: string;
  body: string;
  linkLabel: string;
}) {
  return (
    <main className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">{body}</p>
      <Link
        href={fallbackHref}
        className="btn-neutral mt-6 rounded-lg px-4 py-2 text-sm font-medium"
      >
        {linkLabel}
      </Link>
    </main>
  );
}
