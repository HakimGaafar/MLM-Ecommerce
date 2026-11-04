"use client";

import { useMemo, useState } from "react";

export type CatalogCategoryNode = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  productCount: number;
};

type TreeNode = CatalogCategoryNode & {
  children: TreeNode[];
  totalCount: number;
};

type Ui = {
  allCategories: string;
  categoryFilter: string;
  expand: string;
  collapse: string;
};

function buildTree(flat: CatalogCategoryNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const row of flat) {
    byId.set(row.id, { ...row, children: [], totalCount: row.productCount });
  }
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function rollup(node: TreeNode): number {
    let sum = node.productCount;
    for (const child of node.children) sum += rollup(child);
    node.totalCount = sum;
    return sum;
  }
  for (const root of roots) rollup(root);
  return roots;
}

function findPath(roots: TreeNode[], id: string): TreeNode[] {
  const path: TreeNode[] = [];
  function walk(nodes: TreeNode[], trail: TreeNode[]): boolean {
    for (const node of nodes) {
      const next = [...trail, node];
      if (node.id === id) {
        path.push(...next);
        return true;
      }
      if (walk(node.children, next)) return true;
    }
    return false;
  }
  walk(roots, []);
  return path;
}

function chipClass(active: boolean) {
  return `rounded-full px-3 py-1.5 text-sm transition ${
    active
      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
      : "border border-[var(--border-strong)] text-[var(--foreground)] hover:border-[var(--primary)]"
  }`;
}

export default function CatalogCategoryNav({
  categories,
  selectedId,
  onSelect,
  ui,
  locale,
}: {
  categories: CatalogCategoryNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  ui: Ui;
  locale: "en" | "ar";
}) {
  const tree = useMemo(() => buildTree(categories), [categories]);
  const selectedPath = useMemo(
    () => (selectedId ? findPath(tree, selectedId) : []),
    [tree, selectedId],
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const autoExpanded = useMemo(() => {
    const next = new Set(expandedIds);
    for (const node of selectedPath) next.add(node.id);
    return next;
  }, [expandedIds, selectedPath]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderBranch(nodes: TreeNode[], depth: number) {
    if (nodes.length === 0) return null;
    return (
      <ul
        className={`flex flex-wrap gap-2 ${depth > 0 ? "mt-2 border-[var(--border)] ps-3" : ""}`}
        style={depth > 0 ? { borderInlineStartWidth: 2 } : undefined}
      >
        {nodes.map((node) => {
          const hasChildren = node.children.length > 0;
          const expanded = autoExpanded.has(node.id);
          const active = selectedId === node.id;
          return (
            <li key={node.id} className={hasChildren ? "w-full sm:w-auto" : undefined}>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className={chipClass(active)}
                  onClick={() => onSelect(node.id)}
                  aria-pressed={active}
                >
                  {node.name}
                  <span className="ms-1 opacity-70">({node.totalCount})</span>
                </button>
                {hasChildren ? (
                  <button
                    type="button"
                    className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]"
                    aria-expanded={expanded}
                    aria-label={expanded ? ui.collapse : ui.expand}
                    onClick={() => toggleExpand(node.id)}
                  >
                    {expanded ? (locale === "ar" ? "▾" : "▾") : (locale === "ar" ? "◂" : "▸")}
                  </button>
                ) : null}
              </div>
              {hasChildren && expanded ? (
                <div className="mt-2">{renderBranch(node.children, depth + 1)}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  if (tree.length === 0) return null;

  return (
    <nav className="mb-6 space-y-3" aria-label={ui.categoryFilter}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--muted)]">{ui.categoryFilter}</span>
        <button
          type="button"
          className={chipClass(selectedId == null)}
          onClick={() => onSelect(null)}
          aria-pressed={selectedId == null}
        >
          {ui.allCategories}
        </button>
      </div>

      {selectedPath.length > 0 ? (
        <p className="text-xs text-[var(--muted)]" aria-live="polite">
          {selectedPath.map((n) => n.name).join(locale === "ar" ? " ← " : " → ")}
        </p>
      ) : null}

      {renderBranch(tree, 0)}
    </nav>
  );
}
