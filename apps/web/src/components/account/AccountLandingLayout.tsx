import type { ReactNode } from "react";

export default function AccountLandingLayout({
  title,
  subtitle,
  children,
  announcements,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  announcements: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 animate-page-enter">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
        <p className="mt-2 text-[var(--muted)]">{subtitle}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">{children}</div>
        <div>{announcements}</div>
      </div>
    </main>
  );
}
