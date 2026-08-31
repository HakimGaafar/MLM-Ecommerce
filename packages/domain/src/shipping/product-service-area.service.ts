import { prisma, type Prisma } from "@mlm/db";
import { normalizeDeliveryCity } from "./vendor-delivery-coverage.service";

export type ProductServiceAreaMode = "ALL" | "SPECIFIC";

export type ProductServiceCityDto = {
  countryCode: string;
  city: string;
};

export type ProductServiceAreaInput = {
  serviceAreaMode: ProductServiceAreaMode;
  serviceCities?: Array<{ countryCode: string; city: string }>;
};

export type ServiceAreaWarningDto = {
  itemId?: string;
  productId: string;
  productName: string;
  cities: string[];
  reason: "PRODUCT_SPECIFIC" | "VENDOR_SHIPPING";
};

export type CartDeliveryIssueDto = ServiceAreaWarningDto & { itemId: string };

function cityKey(city: string): string {
  return normalizeDeliveryCity(city).toLowerCase();
}

export function productServiceAreaInputFromPayload(input: ProductServiceAreaInput): ProductServiceAreaInput {
  const mode = input.serviceAreaMode ?? "ALL";
  if (mode === "ALL") {
    return { serviceAreaMode: "ALL", serviceCities: [] };
  }
  const cleaned = (input.serviceCities ?? [])
    .map((c) => ({
      countryCode: c.countryCode.trim().toUpperCase(),
      city: normalizeDeliveryCity(c.city),
    }))
    .filter((c) => c.countryCode.length === 2 && c.city.length >= 2);
  const unique = new Map<string, ProductServiceCityDto>();
  for (const c of cleaned) {
    unique.set(`${c.countryCode}:${cityKey(c.city)}`, c);
  }
  return {
    serviceAreaMode: "SPECIFIC",
    serviceCities: [...unique.values()],
  };
}

export async function replaceProductServiceCities(
  db: Prisma.TransactionClient | typeof prisma,
  productId: string,
  input: ProductServiceAreaInput,
): Promise<void> {
  const normalized = productServiceAreaInputFromPayload(input);
  await db.productServiceCity.deleteMany({ where: { productId } });
  if (normalized.serviceAreaMode === "SPECIFIC" && normalized.serviceCities?.length) {
    await db.productServiceCity.createMany({
      data: normalized.serviceCities.map((c) => ({
        productId,
        countryCode: c.countryCode,
        city: c.city,
      })),
    });
  }
}

export async function listProductServiceCities(productId: string): Promise<ProductServiceCityDto[]> {
  const rows = await prisma.productServiceCity.findMany({
    where: { productId },
    orderBy: [{ countryCode: "asc" }, { city: "asc" }],
    select: { countryCode: true, city: true },
  });
  return rows;
}

export async function productCoversServiceArea(params: {
  productId: string;
  countryCode: string;
  city: string;
}): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    select: {
      serviceAreaMode: true,
      serviceCities: { select: { countryCode: true, city: true } },
    },
  });
  if (!product) return false;
  if (product.serviceAreaMode !== "SPECIFIC") return true;

  const country = params.countryCode.trim().toUpperCase();
  const city = cityKey(params.city);
  if (!country || !city) return false;

  return product.serviceCities.some(
    (row) => row.countryCode === country && cityKey(row.city) === city,
  );
}

export async function computeServiceAreaWarnings(params: {
  lines: Array<{ productId: string; productName: string; vendorId: string; stockLocation?: string }>;
  countryCode: string;
  city: string;
}): Promise<ServiceAreaWarningDto[]> {
  const country = params.countryCode.trim().toUpperCase();
  const city = cityKey(params.city);
  if (!country || !city) return [];

  const { vendorCoversCity } = await import("./vendor-delivery-coverage.service");
  const warnings: ServiceAreaWarningDto[] = [];

  for (const line of params.lines) {
    if (line.stockLocation !== "MERCHANT") continue;

    const product = await prisma.product.findUnique({
      where: { id: line.productId },
      select: {
        serviceAreaMode: true,
        serviceCities: { select: { city: true, countryCode: true } },
      },
    });
    if (!product) continue;

    if (product.serviceAreaMode === "SPECIFIC") {
      const covered = product.serviceCities.some(
        (row) => row.countryCode === country && cityKey(row.city) === city,
      );
      if (!covered) {
        warnings.push({
          productId: line.productId,
          productName: line.productName,
          cities: product.serviceCities.map((row) => row.city),
          reason: "PRODUCT_SPECIFIC",
        });
      }
      continue;
    }

    const vendorCovered = await vendorCoversCity({
      vendorId: line.vendorId,
      countryCode: country,
      city: params.city,
    });
    if (!vendorCovered) {
      warnings.push({
        productId: line.productId,
        productName: line.productName,
        cities: [],
        reason: "VENDOR_SHIPPING",
      });
    }
  }

  return warnings;
}
