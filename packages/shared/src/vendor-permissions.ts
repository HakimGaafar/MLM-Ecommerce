/** CRUD-style vendor permission codes: `vendor:{module}:{action}` or `vendor:orders:payment:edit`. */
export const VENDOR_PERMISSION_CODES = [
  "vendor:dashboard:read",
  "vendor:products:read",
  "vendor:products:write",
  "vendor:products:edit",
  "vendor:products:delete",
  "vendor:products:qna:read",
  "vendor:products:qna:edit",
  "vendor:orders:read",
  "vendor:orders:edit",
  "vendor:orders:payment:edit",
  "vendor:coupons:read",
  "vendor:coupons:write",
  "vendor:coupons:edit",
  "vendor:coupons:delete",
  "vendor:wallet:read",
  "vendor:wallet:edit",
  "vendor:store:read",
  "vendor:store:edit",
  "vendor:setup:read",
  "vendor:setup:edit",
  "vendor:team:read",
  "vendor:team:edit",
] as const;

export type VendorPermissionCode = (typeof VENDOR_PERMISSION_CODES)[number];

export type VendorPermissionAction = "read" | "write" | "edit" | "delete";

export type VendorPermissionGroupId =
  | "dashboard"
  | "products"
  | "orders"
  | "coupons"
  | "wallet"
  | "store"
  | "setup"
  | "team";

export type VendorPermissionUiEntry = {
  code: VendorPermissionCode;
  /** i18n key under `adminVendorPermissions.actionLabels` (e.g. `read`, `paymentEdit`). */
  actionKey: VendorPermissionAction | "paymentEdit";
};

export type VendorPermissionUiGroup = {
  id: VendorPermissionGroupId;
  permissions: readonly VendorPermissionUiEntry[];
};

/** Grouped structure for the admin permissions UI (vendor → module → actions). */
export const VENDOR_PERMISSION_UI_GROUPS: readonly VendorPermissionUiGroup[] = [
  {
    id: "dashboard",
    permissions: [{ code: "vendor:dashboard:read", actionKey: "read" }],
  },
  {
    id: "products",
    permissions: [
      { code: "vendor:products:read", actionKey: "read" },
      { code: "vendor:products:write", actionKey: "write" },
      { code: "vendor:products:edit", actionKey: "edit" },
      { code: "vendor:products:delete", actionKey: "delete" },
      { code: "vendor:products:qna:read", actionKey: "read" },
      { code: "vendor:products:qna:edit", actionKey: "edit" },
    ],
  },
  {
    id: "orders",
    permissions: [
      { code: "vendor:orders:read", actionKey: "read" },
      { code: "vendor:orders:edit", actionKey: "edit" },
      { code: "vendor:orders:payment:edit", actionKey: "paymentEdit" },
    ],
  },
  {
    id: "coupons",
    permissions: [
      { code: "vendor:coupons:read", actionKey: "read" },
      { code: "vendor:coupons:write", actionKey: "write" },
      { code: "vendor:coupons:edit", actionKey: "edit" },
      { code: "vendor:coupons:delete", actionKey: "delete" },
    ],
  },
  {
    id: "wallet",
    permissions: [
      { code: "vendor:wallet:read", actionKey: "read" },
      { code: "vendor:wallet:edit", actionKey: "edit" },
    ],
  },
  {
    id: "store",
    permissions: [
      { code: "vendor:store:read", actionKey: "read" },
      { code: "vendor:store:edit", actionKey: "edit" },
    ],
  },
  {
    id: "setup",
    permissions: [
      { code: "vendor:setup:read", actionKey: "read" },
      { code: "vendor:setup:edit", actionKey: "edit" },
    ],
  },
  {
    id: "team",
    permissions: [
      { code: "vendor:team:read", actionKey: "read" },
      { code: "vendor:team:edit", actionKey: "edit" },
    ],
  },
] as const;

/** Maps deprecated codes (saved before CRUD split) to the new codes they implied. */
export const VENDOR_LEGACY_PERMISSION_MAP: Record<string, readonly VendorPermissionCode[]> = {
  "vendor:products:write": ["vendor:products:write", "vendor:products:edit"],
  "vendor:store:write": ["vendor:store:read", "vendor:store:edit"],
  "vendor:setup:write": ["vendor:setup:read", "vendor:setup:edit"],
  "vendor:orders:write": ["vendor:orders:edit"],
  "vendor:orders:payment:write": ["vendor:orders:payment:edit"],
  "vendor:coupons:write": [
    "vendor:coupons:read",
    "vendor:coupons:write",
    "vendor:coupons:edit",
    "vendor:coupons:delete",
  ],
};

const READ_IMPLIES: Partial<Record<VendorPermissionCode, readonly VendorPermissionCode[]>> = {
  "vendor:products:read": [
    "vendor:products:write",
    "vendor:products:edit",
    "vendor:products:delete",
    "vendor:products:qna:read",
    "vendor:products:qna:edit",
  ],
  "vendor:products:qna:read": ["vendor:products:qna:edit"],
  "vendor:orders:read": ["vendor:orders:edit", "vendor:orders:payment:edit"],
  "vendor:coupons:read": ["vendor:coupons:write", "vendor:coupons:edit", "vendor:coupons:delete"],
  "vendor:wallet:read": ["vendor:wallet:edit"],
  "vendor:store:read": ["vendor:store:edit"],
  "vendor:setup:read": ["vendor:setup:edit"],
  "vendor:team:read": ["vendor:team:edit"],
};

const EDIT_IMPLIES: Partial<Record<VendorPermissionCode, readonly VendorPermissionCode[]>> = {
  "vendor:coupons:edit": ["vendor:coupons:delete"],
};

export function expandLegacyVendorPermissionCodes(
  codes: readonly string[],
): VendorPermissionCode[] {
  const allowed = new Set<string>(VENDOR_PERMISSION_CODES);
  const out = new Set<VendorPermissionCode>();
  for (const raw of codes) {
    if (allowed.has(raw)) {
      out.add(raw as VendorPermissionCode);
      continue;
    }
    const mapped = VENDOR_LEGACY_PERMISSION_MAP[raw];
    if (mapped) {
      for (const code of mapped) out.add(code);
    }
  }
  return [...out];
}

export function vendorHasPermission(
  granted: readonly VendorPermissionCode[],
  code: VendorPermissionCode,
): boolean {
  const effective = expandLegacyVendorPermissionCodes(granted);
  if (effective.includes(code)) return true;

  const readAlso = READ_IMPLIES[code];
  if (readAlso?.some((c) => effective.includes(c))) return true;

  const editAlso = EDIT_IMPLIES[code];
  if (editAlso?.some((c) => effective.includes(c))) return true;

  return false;
}
