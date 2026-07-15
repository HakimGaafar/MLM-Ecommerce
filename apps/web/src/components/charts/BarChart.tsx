export default function BarChart({
  items,
}: {
  items: { label: string; value: number; display?: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return null;

  return (
    <ul className="mt-4 space-y-2">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex justify-between gap-2 text-xs text-[var(--muted)]">
            <span className="truncate font-medium text-[var(--foreground)]">{item.label}</span>
            <span className="shrink-0 tabular-nums">{item.display ?? String(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--table-head-bg)]">
            <div
              className="h-full rounded-full bg-[var(--primary)]"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
