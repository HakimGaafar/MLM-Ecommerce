import fs from "fs";
import path from "path";

const root = process.cwd();
const dirs = [
  "apps/web/src/app/admin",
  "apps/web/src/app/vendor",
  "apps/web/src/app/customer",
  "apps/web/src/app/sell",
  "apps/web/src/app/(portal)",
];

/** @type {readonly [RegExp, string][]} */
const subs = [
  [
    /border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900\/50/g,
    "border-b border-[var(--border)] bg-[var(--table-head-bg)]",
  ],
  [/border-b border-zinc-200 dark:border-zinc-800/g, "border-b border-[var(--border)]"],
  [/border-t border-zinc-200 dark:border-zinc-800/g, "border-t border-[var(--border)]"],
  [/bg-zinc-50 dark:bg-zinc-900\/50/g, "bg-[var(--table-head-bg)]"],
  [/bg-zinc-50 dark:bg-zinc-900(?!\/)/g, "bg-[var(--table-head-bg)]"],
  [/border-zinc-200 dark:border-zinc-800/g, "border-[var(--border)]"],
  [/border-zinc-100 dark:border-zinc-800/g, "border-[var(--table-row-border)]"],
  [/divide-zinc-200 dark:divide-zinc-800/g, "divide-[var(--border)]"],
  [/border-zinc-300 dark:border-zinc-600/g, "border-[var(--border-strong)]"],
  [/border-zinc-300 dark:border-zinc-700/g, "border-[var(--border-strong)]"],
  [/border-dashed border-zinc-300 dark:border-zinc-700/g, "border-dashed border-[var(--border-strong)]"],
  [/border-zinc-700 dark:border-zinc-700/g, "border-[var(--border-strong)]"],
  [/text-zinc-500 dark:text-zinc-400/g, "text-[var(--muted)]"],
  [/text-zinc-600 dark:text-zinc-400/g, "text-[var(--muted)]"],
  [/text-zinc-800 dark:text-zinc-200/g, "text-[var(--foreground)]"],
  [/text-zinc-900 dark:text-zinc-100/g, "text-[var(--foreground)]"],
  [/text-zinc-700 dark:text-zinc-300/g, "text-[var(--foreground)]"],
  [/bg-white dark:bg-zinc-950/g, "bg-[var(--surface)]"],
  [/bg-indigo-600 text-white/g, "bg-[var(--primary)] text-[var(--primary-foreground)]"],
  [
    /border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300/g,
    "border border-[var(--border-strong)] text-[var(--foreground)]",
  ],
  [/text-indigo-600 underline/g, "text-link underline"],
  [/text-xs text-indigo-600 underline/g, "text-xs text-link underline"],
  [/ring-indigo-500 focus:ring-2/g, "focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)]"],
  [
    /rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60/g,
    "btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60",
  ],
  [
    /rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50/g,
    "btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50",
  ],
  [
    /bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50/g,
    "btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50",
  ],
  [/bg-indigo-600 px-3 py-1 text-xs text-white disabled:opacity-50/g, "btn-primary px-3 py-1 text-xs disabled:opacity-50"],
  [/bg-zinc-100 dark:bg-zinc-800/g, "bg-[color-mix(in_srgb,var(--foreground)_8%,var(--surface))]"],
  [/border-zinc-200 dark:border-zinc-700/g, "border-[var(--border)]"],
  [/hover:bg-zinc-50 dark:hover:bg-zinc-800/g, "hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]"],
  [/hover:bg-zinc-50 dark:hover:bg-zinc-900/g, "hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]"],
  [/dark:border-zinc-600 dark:bg-zinc-950/g, "dark:border-[var(--border-strong)] dark:bg-[var(--surface)]"],
  [/bg-zinc-600 px-3 py-1 text-xs text-white/g, "btn-primary px-3 py-1 text-xs"],
  [
    /font-medium text-indigo-700 hover:underline dark:text-indigo-300/g,
    "font-medium text-link hover:underline",
  ],
  [/border border-zinc-200 bg-white p-5 dark:border-zinc-800/g, "border border-[var(--border)] bg-[var(--surface)] p-5"],
  [/border border-zinc-200 bg-white/g, "border border-[var(--border)] bg-[var(--surface)]"],
  [
    /inline-flex rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-200 dark:hover:bg-indigo-950/g,
    "inline-flex rounded-lg border border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] dark:text-[var(--primary)]",
  ],
  [/h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/g, "h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--foreground)_8%,var(--surface))]"],
  [/h-full rounded-full bg-indigo-500 dark:bg-indigo-400/g, "h-full rounded-full bg-[var(--primary)]"],
  [/rounded-lg border border-zinc-200 dark:border-zinc-800/g, "rounded-lg border border-[var(--border)]"],
  [/border border-zinc-200 p-6 dark:border-zinc-800/g, "border border-[var(--border)] p-6"],
  [
    /rounded-xl border border-zinc-200 p-6 dark:border-zinc-800/g,
    "rounded-xl border border-[var(--border)] p-6",
  ],
  [
    /rounded-xl border border-zinc-200 p-4 dark:border-zinc-800/g,
    "rounded-xl border border-[var(--border)] p-4",
  ],
  [
    /mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800/g,
    "mt-10 border-t border-[var(--border)] pt-8",
  ],
  [/border-zinc-200 bg-white/g, "border-[var(--border)] bg-[var(--surface)]"],
  [
    /rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60/g,
    "btn-neutral rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60",
  ],
  [
    /rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50/g,
    "btn-neutral rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50",
  ],
  [
    /rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60/g,
    "btn-neutral rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60",
  ],
  [
    /rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50/g,
    "btn-neutral rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50",
  ],
  [
    /rounded-lg bg-zinc-900 px-3 py-1\.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900/g,
    "btn-neutral rounded-lg px-3 py-1.5 text-sm",
  ],
  [
    /rounded-lg bg-zinc-900 px-3 py-1\.5 text-xs font-medium text-white disabled:opacity-50/g,
    "btn-neutral rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50",
  ],
  [
    /rounded-lg bg-zinc-900 px-3 py-1\.5 text-sm text-white/g,
    "btn-neutral rounded-lg px-3 py-1.5 text-sm",
  ],
  [
    /bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50/g,
    "btn-neutral px-4 py-2 text-sm font-medium disabled:opacity-50",
  ],
  [
    /rounded-lg bg-zinc-900 px-3 py-1\.5 text-xs font-medium text-white/g,
    "btn-neutral rounded-lg px-3 py-1.5 text-xs font-medium",
  ],
  [/border-zinc-200 dark:bg-zinc-950/g, "border-[var(--border)] dark:bg-[var(--surface)]"],
  // --- phase 2: leftover single zinc utilities ---
  [/dark:border-zinc-800 dark:bg-zinc-950/g, "dark:border-[var(--border)] dark:bg-[var(--surface)]"],
  [/dark:border-zinc-800/g, "dark:border-[var(--border)]"],
  [/dark:bg-zinc-950/g, "dark:bg-[var(--surface)]"],
  [/dark:border-zinc-700/g, "dark:border-[var(--border-strong)]"],
  [/dark:hover:bg-zinc-800/g, "dark:hover:bg-[color-mix(in_srgb,var(--foreground)_8%,var(--surface))]"],
  [/dark:hover:bg-zinc-900/g, "dark:hover:bg-[color-mix(in_srgb,var(--foreground)_8%,var(--surface))]"],
  [/dark:bg-zinc-900\/50/g, "dark:bg-[color-mix(in_srgb,var(--foreground)_6%,var(--surface))]"],
  [/dark:bg-zinc-900/g, "dark:bg-[var(--surface)]"],
  [/dark:bg-zinc-100 dark:text-\[var\(--foreground\)\]/g, ""],
  [/dark:bg-zinc-100 dark:text-zinc-900/g, ""],
  [/dark:hover:bg-zinc-300/g, ""],
  [/dark:text-zinc-200/g, "dark:text-[var(--foreground)]"],
  [/dark:text-zinc-100/g, "dark:text-[var(--foreground)]"],
  [/text-zinc-500/g, "text-[var(--muted)]"],
  [/text-zinc-400/g, "text-[var(--muted)]"],
  [/text-zinc-800/g, "text-[var(--foreground)]"],
  [/text-zinc-700/g, "text-[var(--foreground)]"],
  [/border-zinc-300/g, "border-[var(--border-strong)]"],
  [/border-zinc-200/g, "border-[var(--border)]"],
  [/border-zinc-100/g, "border-[var(--table-row-border)]"],
  [/bg-zinc-100/g, "bg-[color-mix(in_srgb,var(--foreground)_6%,var(--surface))]"],
  [/bg-zinc-200/g, "bg-[color-mix(in_srgb,var(--foreground)_12%,var(--surface))]"],
  [/bg-zinc-50/g, "bg-[var(--table-head-bg)]"],
  [/hover:bg-zinc-100/g, "hover:bg-[color-mix(in_srgb,var(--foreground)_8%,var(--surface))]"],
  [/hover:bg-zinc-50/g, "hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]"],
  [/bg-zinc-900 text-white/g, "bg-[var(--foreground)] text-[var(--background)]"],
  [
    /rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-\[var\(--foreground\)\]/g,
    "btn-neutral rounded-lg px-4 py-2 text-sm font-medium",
  ],
  [
    /mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-\[var\(--foreground\)\]/g,
    "btn-neutral mt-6 rounded-lg px-4 py-2 text-sm font-medium",
  ],
  [
    /rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50/g,
    "btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50",
  ],
  [
    /className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-\[var\(--foreground\)\] dark:hover:bg-zinc-300"/g,
    'className="w-full btn-neutral rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"',
  ],
  [/btn-primary btn-press dark:hover:bg-zinc-300/g, "btn-primary btn-press"],
];

function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith(".tsx")) {
      let c = fs.readFileSync(p, "utf8");
      const o = c;
      for (const [re, rep] of subs) c = c.replace(re, rep);
      if (c !== o) {
        fs.writeFileSync(p, c);
        console.log("patched", p);
      }
    }
  }
}

for (const d of dirs) walk(path.join(root, d));
console.log("done");
