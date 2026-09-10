import { prisma } from "@mlm/db";

export const VENDOR_FORM_LIST_KEYS = ["LICENSE_TYPE"] as const;
export type VendorFormListKey = (typeof VENDOR_FORM_LIST_KEYS)[number];

export type VendorFormListOptionDto = {
  id: string;
  listKey: string;
  code: string;
  labelEn: string;
  labelAr: string;
  sortOrder: number;
  isActive: boolean;
};

export class VendorFormListError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "DUPLICATE_CODE" | "INVALID_LIST_KEY" | "VALIDATION",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorFormListError";
  }
}

function toDto(row: {
  id: string;
  listKey: string;
  code: string;
  labelEn: string;
  labelAr: string;
  sortOrder: number;
  isActive: boolean;
}): VendorFormListOptionDto {
  return {
    id: row.id,
    listKey: row.listKey,
    code: row.code,
    labelEn: row.labelEn,
    labelAr: row.labelAr,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

function assertListKey(listKey: string): asserts listKey is VendorFormListKey {
  if (!(VENDOR_FORM_LIST_KEYS as readonly string[]).includes(listKey)) {
    throw new VendorFormListError("INVALID_LIST_KEY", "Unsupported list key.");
  }
}

export async function listVendorFormListOptions(params: {
  listKey: string;
  activeOnly?: boolean;
}): Promise<VendorFormListOptionDto[]> {
  assertListKey(params.listKey);
  const rows = await prisma.vendorFormListOption.findMany({
    where: {
      listKey: params.listKey,
      ...(params.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { labelEn: "asc" }],
  });
  return rows.map(toDto);
}

export async function createVendorFormListOption(input: {
  listKey: string;
  code: string;
  labelEn: string;
  labelAr: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<VendorFormListOptionDto> {
  assertListKey(input.listKey);
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");
  if (!code || code.length > 64) {
    throw new VendorFormListError("VALIDATION", "Invalid option code.");
  }
  const labelEn = input.labelEn.trim();
  const labelAr = input.labelAr.trim();
  if (!labelEn || !labelAr) {
    throw new VendorFormListError("VALIDATION", "English and Arabic labels are required.");
  }

  try {
    const row = await prisma.vendorFormListOption.create({
      data: {
        listKey: input.listKey,
        code,
        labelEn,
        labelAr,
        sortOrder: input.sortOrder ?? 100,
        isActive: input.isActive ?? true,
      },
    });
    return toDto(row);
  } catch {
    throw new VendorFormListError("DUPLICATE_CODE", "An option with this code already exists.");
  }
}

export async function updateVendorFormListOption(
  id: string,
  input: {
    labelEn?: string;
    labelAr?: string;
    sortOrder?: number;
    isActive?: boolean;
  },
): Promise<VendorFormListOptionDto> {
  const existing = await prisma.vendorFormListOption.findUnique({ where: { id } });
  if (!existing) throw new VendorFormListError("NOT_FOUND", "Option not found.");

  const row = await prisma.vendorFormListOption.update({
    where: { id },
    data: {
      ...(input.labelEn !== undefined ? { labelEn: input.labelEn.trim() } : {}),
      ...(input.labelAr !== undefined ? { labelAr: input.labelAr.trim() } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  return toDto(row);
}

export async function deleteVendorFormListOption(id: string): Promise<void> {
  const existing = await prisma.vendorFormListOption.findUnique({ where: { id } });
  if (!existing) throw new VendorFormListError("NOT_FOUND", "Option not found.");
  await prisma.vendorFormListOption.delete({ where: { id } });
}
