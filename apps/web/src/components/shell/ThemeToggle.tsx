"use client";

import { useRouter } from "next/navigation";
import type { ThemePreference } from "@/lib/theme-preference";

export default function ThemeToggle({
  theme,
  labels,
}: {
  theme: ThemePreference;
  labels: { light: string; dark: string };
}) {
  const router = useRouter();
  const next: ThemePreference = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? labels.dark : labels.light;

  async function toggleTheme() {
    document.documentElement.classList.toggle("dark", next === "dark");
    await fetch("/api/v1/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void toggleTheme()}
      className="btn-press rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold"
      aria-label={label}
      title={label}
    >
      {label}
    </button>
  );
}
