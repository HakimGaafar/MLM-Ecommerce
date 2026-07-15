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

  async function setTheme(next: ThemePreference) {
    if (next === theme) return;
    document.documentElement.classList.toggle("dark", next === "dark");
    await fetch("/api/v1/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });
    router.refresh();
  }

  return (
    <div dir="ltr" className="flex rounded-full bg-[var(--border)] p-0.5" role="group" aria-label="Theme">
      <button
        type="button"
        onClick={() => void setTheme("light")}
        className={`btn-press rounded-full px-2 py-0.5 text-xs font-semibold ${
          theme === "light" ? "bg-[var(--primary)] text-white" : ""
        }`}
      >
        {labels.light}
      </button>
      <button
        type="button"
        onClick={() => void setTheme("dark")}
        className={`btn-press rounded-full px-2 py-0.5 text-xs font-semibold ${
          theme === "dark" ? "bg-[var(--primary)] text-white" : ""
        }`}
      >
        {labels.dark}
      </button>
    </div>
  );
}
