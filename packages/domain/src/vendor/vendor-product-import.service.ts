import {
  parseCsvContent,
  VENDOR_PRODUCT_IMPORT_MAX_ROWS,
  VendorProductImportRowSchema,
} from "@mlm/shared";
import { prisma } from "@mlm/db";
import { resolveCategoryId } from "../catalog/product-categories.service";
import { createVendorProduct } from "./vendor-products.service";

export type VendorProductImportRowResult =
  | { row: number; status: "created"; productId: string; name: string; warning?: string }
  | { row: number; status: "failed"; message: string };

export type VendorProductImportResult = {
  createdCount: number;
  failedCount: number;
  results: VendorProductImportRowResult[];
};

export class VendorProductImportError extends Error {
  constructor(
    public readonly code: "EMPTY" | "INVALID_HEADER" | "NO_ROWS" | "TOO_MANY_ROWS",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorProductImportError";
  }
}

type ImportField = "name" | "price" | "category" | "imageUrl" | "qty";

const HEADER_ALIASES: Record<string, ImportField> = {
  name: "name",
  product_name: "name",
  productname: "name",
  price: "price",
  category: "category",
  category_slug: "category",
  categoryslug: "category",
  category_id: "category",
  categoryid: "category",
  image_url: "imageUrl",
  imageurl: "imageUrl",
  image: "imageUrl",
  qty: "qty",
  quantity: "qty",
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function buildHeaderMap(headerRow: string[]): Map<ImportField, number> {
  const map = new Map<ImportField, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const field = HEADER_ALIASES[normalizeHeader(headerRow[i] ?? "")];
    if (field && !map.has(field)) map.set(field, i);
  }
  return map;
}

async function resolveCategoryValue(value: string, marketId: string): Promise<string | undefined> {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const byId = await resolveCategoryId({ marketId, categoryId: trimmed });
  if (byId) return byId;
  return resolveCategoryId({ marketId, categorySlug: trimmed });
}

function rowToRecord(cells: string[], headerMap: Map<ImportField, number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, index] of headerMap) {
    out[field] = cells[index] ?? "";
  }
  return out;
}

export async function importVendorProductsFromCsv(
  vendorId: string,
  csvText: string,
  locale: "en" | "ar" = "en",
): Promise<VendorProductImportResult> {
  const vendor = await prisma.vendor.findUniqueOrThrow({
    where: { id: vendorId },
    select: { marketId: true },
  });

  const table = parseCsvContent(csvText);
  if (table.length === 0) {
    throw new VendorProductImportError("EMPTY", "CSV file is empty.");
  }

  const headerMap = buildHeaderMap(table[0] ?? []);
  if (!headerMap.has("name") || !headerMap.has("price") || !headerMap.has("category") || !headerMap.has("imageUrl")) {
    throw new VendorProductImportError(
      "INVALID_HEADER",
      "Header must include: name, price, category, image_url (or aliases).",
    );
  }

  const dataRows = table.slice(1).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (dataRows.length === 0) {
    throw new VendorProductImportError("NO_ROWS", "No product rows found after the header.");
  }
  if (dataRows.length > VENDOR_PRODUCT_IMPORT_MAX_ROWS) {
    throw new VendorProductImportError(
      "TOO_MANY_ROWS",
      `Maximum ${VENDOR_PRODUCT_IMPORT_MAX_ROWS} products per import.`,
    );
  }

  const results: VendorProductImportRowResult[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2;
    const raw = rowToRecord(dataRows[i] ?? [], headerMap);
    const parsed = VendorProductImportRowSchema.safeParse({
      name: raw.name,
      price: raw.price,
      category: raw.category,
      imageUrl: raw.imageUrl,
      qty: raw.qty?.trim() ? raw.qty : undefined,
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const path = first?.path.join(".") || "row";
      results.push({
        row: rowNumber,
        status: "failed",
        message: `${path}: ${first?.message ?? "Invalid row"}`,
      });
      continue;
    }

    const categoryId = await resolveCategoryValue(parsed.data.category, vendor.marketId);
    if (!categoryId) {
      results.push({
        row: rowNumber,
        status: "failed",
        message: `Unknown category "${parsed.data.category}". Use a category slug (e.g. electronics) or id.`,
      });
      continue;
    }

    try {
      const product = await createVendorProduct(
        vendorId,
        {
          name: parsed.data.name,
          price: parsed.data.price,
          currency: "SAR",
          categoryId,
          images: [{ url: parsed.data.imageUrl, sortOrder: 0, isPrimary: true }],
        },
        locale,
      );
      results.push({
        row: rowNumber,
        status: "created",
        productId: product.id,
        name: product.name,
        ...(parsed.data.qty !== undefined
          ? { warning: "Quantity column is not stored yet (no inventory field on products)." }
          : {}),
      });
    } catch {
      results.push({
        row: rowNumber,
        status: "failed",
        message: "Could not create product.",
      });
    }
  }

  const createdCount = results.filter((r) => r.status === "created").length;
  return {
    createdCount,
    failedCount: results.length - createdCount,
    results,
  };
}
