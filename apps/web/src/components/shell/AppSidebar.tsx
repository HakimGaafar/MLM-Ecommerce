"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppOverlay from "@/components/ui/AppOverlay";
import {
  flattenShellNavSections,
  isShellNavItemActive,
  type ShellNavItem,
  type ShellNavSection,
} from "@/lib/build-app-nav";

function SidebarNavLinks({
  items,
  allItems,
  pathname,
  onClose,
}: {
  items: ShellNavItem[];
  allItems: ShellNavItem[];
  pathname: string | null;
  onClose: () => void;
}) {
  return (
    <>
      {items.map((link) => {
        const isActive = isShellNavItemActive(pathname, link, allItems);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className={`btn-press rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                : "text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

export default function AppSidebar({
  locale,
  title,
  items,
  sections,
  mobileOpen,
  onClose,
}: {
  locale: "en" | "ar";
  title: string;
  items: ShellNavItem[];
  sections?: ShellNavSection[];
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const isRtl = locale === "ar";
  const allItems = sections ? flattenShellNavSections(sections) : items;

  const panel = (
    <aside
      className={`flex h-full w-[var(--sidebar-width)] shrink-0 flex-col border-[var(--border)] bg-[var(--surface)] ${
        isRtl ? "border-s" : "border-e"
      }`}
      dir={direction}
    >
      <div className="animate-sidebar-enter flex-1 overflow-y-auto p-3">
        {title.trim() ? (
          <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {title}
          </p>
        ) : null}
        {sections ? (
          <div className="flex flex-col gap-4">
            {sections.map((section) => (
              <div key={section.id}>
                {section.label?.trim() ? (
                  <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {section.label}
                  </p>
                ) : null}
                <nav className="flex flex-col gap-0.5">
                  <SidebarNavLinks
                    items={section.items}
                    allItems={allItems}
                    pathname={pathname}
                    onClose={onClose}
                  />
                </nav>
              </div>
            ))}
          </div>
        ) : (
          <nav className="flex flex-col gap-1">
            <SidebarNavLinks
              items={items}
              allItems={allItems}
              pathname={pathname}
              onClose={onClose}
            />
          </nav>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <AppOverlay
        variant="backdrop"
        open={mobileOpen}
        onClose={onClose}
        zIndex={40}
        backdropLabel="Close menu"
      />

      <div
        className={`${
          mobileOpen ? "flex" : "hidden lg:flex"
        } fixed inset-y-0 z-50 pt-[var(--header-height)] transition-transform duration-300 ease-out lg:static lg:z-auto lg:pt-0 lg:translate-x-0 ${
          isRtl ? "end-0" : "start-0"
        } ${
          mobileOpen
            ? "translate-x-0"
            : isRtl
              ? "translate-x-full lg:translate-x-0"
              : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {panel}
      </div>
    </>
  );
}
