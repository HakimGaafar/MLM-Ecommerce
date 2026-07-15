"use client";

export type GenealogyTreeNode = {
  userId: string;
  name: string;
  referralCode: string;
  rankTitle: string;
  depth: number;
  joinedAt: string;
  directReferrals: number;
  children: GenealogyTreeNode[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function NodeCard({
  node,
  isRoot,
  labels,
}: {
  node: GenealogyTreeNode;
  isRoot: boolean;
  labels: { level: string; referrals: string };
}) {
  return (
    <div
      className={`genealogy-tree-card ${isRoot ? "genealogy-tree-card--root" : ""}`}
      title={node.referralCode}
    >
      <div className="genealogy-tree-avatar" aria-hidden>
        {initials(node.name)}
      </div>
      <p className="genealogy-tree-name">{node.name}</p>
      <span className="genealogy-tree-rank">{node.rankTitle}</span>
      <p className="genealogy-tree-meta">
        <span>
          {labels.level} {node.depth}
        </span>
        <span className="genealogy-tree-meta-sep" aria-hidden>
          ·
        </span>
        <span>
          {labels.referrals}: {node.directReferrals}
        </span>
      </p>
      <p className="genealogy-tree-code">{node.referralCode}</p>
    </div>
  );
}

function TreeBranch({
  node,
  isRoot,
  labels,
}: {
  node: GenealogyTreeNode;
  isRoot: boolean;
  labels: { level: string; referrals: string; emptyChildren: string };
}) {
  const hasChildren = node.children.length > 0;

  return (
    <li className="genealogy-tree-li">
      <NodeCard node={node} isRoot={isRoot} labels={labels} />
      {hasChildren ? (
        <ul className="genealogy-tree-ul">
          {node.children.map((child) => (
            <TreeBranch key={child.userId} node={child} isRoot={false} labels={labels} />
          ))}
        </ul>
      ) : !isRoot ? (
        <p className="genealogy-tree-leaf-hint">{labels.emptyChildren}</p>
      ) : null}
    </li>
  );
}

/**
 * Top-down org-chart genealogy (CSS connectors). Chart layout is LTR so lines align;
 * card text still follows page locale via inherited direction on the scroll wrapper.
 */
export default function GenealogyTree({
  root,
  locale,
  labels,
}: {
  root: GenealogyTreeNode;
  locale: "en" | "ar";
  labels: {
    level: string;
    referrals: string;
    emptyChildren: string;
  };
}) {
  const textDirection = locale === "ar" ? "rtl" : "ltr";

  return (
    <div className="genealogy-tree-scroll" dir={textDirection}>
      <div className="genealogy-tree-chart" dir="ltr">
        <ul className="genealogy-tree-ul genealogy-tree-ul--root">
          <TreeBranch node={root} isRoot labels={labels} />
        </ul>
      </div>
    </div>
  );
}
