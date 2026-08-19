"use client";

import { useLiveCopy } from "@/components/ui/live-i18n";

export default function AccountAnnouncements({ audience }: { audience: "customer" | "merchant" | "marketer" }) {
  const ui = useLiveCopy("accountPortal");
  const items = ui.announcements[audience] as Array<{ title: string; body: string; date: string }>;

  return (
    <aside className="app-card h-fit p-5">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{ui.announcementsTitle}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{ui.announcementsSubtitle}</p>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={`${item.date}-${item.title}`} className="border-b border-[var(--border)] pb-4 last:border-0 last:pb-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{item.date}</p>
            <p className="mt-1 font-medium text-[var(--foreground)]">{item.title}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
