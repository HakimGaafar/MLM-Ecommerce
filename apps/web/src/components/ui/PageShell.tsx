import type { ReactNode } from "react";

const MAX_WIDTH = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
} as const;

export function PageShell({
  children,
  dir,
  className = "",
  maxWidth = "6xl",
}: {
  children: ReactNode;
  dir?: "ltr" | "rtl";
  className?: string;
  maxWidth?: keyof typeof MAX_WIDTH;
}) {
  return (
    <main
      className={`mx-auto w-full ${MAX_WIDTH[maxWidth]} flex-1 p-6 sm:p-8 animate-page-enter ${className}`.trim()}
      dir={dir}
    >
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
