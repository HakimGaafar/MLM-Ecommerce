import { prisma } from "@mlm/db";

export function normalizeDeliveryCity(city: string): string {
  return city.trim().replace(/\s+/g, " ");
}

function cityKey(city: string): string {
  return normalizeDeliveryCity(city).toLowerCase();
}

export type VendorDeliveryCityDto = {
  id: string;
  countryCode: string;
  city: string;
};

export async function listVendorDeliveryCities(vendorId: string): Promise<VendorDeliveryCityDto[]> {
  const rows = await prisma.vendorDeliveryCity.findMany({
    where: { vendorId },
    orderBy: [{ countryCode: "asc" }, { city: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    countryCode: r.countryCode,
    city: r.city,
  }));
}

export async function replaceVendorDeliveryCities(params: {
  vendorId: string;
  cities: Array<{ countryCode: string; city: string }>;
}): Promise<VendorDeliveryCityDto[]> {
  const cleaned = params.cities
    .map((c) => ({
      countryCode: c.countryCode.trim().toUpperCase(),
      city: normalizeDeliveryCity(c.city),
    }))
    .filter((c) => c.countryCode.length === 2 && c.city.length >= 2);

  const unique = new Map<string, { countryCode: string; city: string }>();
  for (const c of cleaned) {
    unique.set(`${c.countryCode}:${cityKey(c.city)}`, c);
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorDeliveryCity.deleteMany({ where: { vendorId: params.vendorId } });
    if (unique.size > 0) {
      await tx.vendorDeliveryCity.createMany({
        data: [...unique.values()].map((c) => ({
          vendorId: params.vendorId,
          countryCode: c.countryCode,
          city: c.city,
        })),
      });
    }
  });

  return listVendorDeliveryCities(params.vendorId);
}

export async function vendorHasWarehouseAddress(vendorId: string): Promise<boolean> {
  const row = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { addressLine1: true, city: true, countryCode: true },
  });
  return Boolean(row?.addressLine1?.trim() && row.city?.trim() && row.countryCode?.trim());
}

export async function vendorCoversCity(params: {
  vendorId: string;
  countryCode: string;
  city: string;
}): Promise<boolean> {
  const country = params.countryCode.trim().toUpperCase();
  const city = cityKey(params.city);
  if (!country || !city) return false;

  const rows = await prisma.vendorDeliveryCity.findMany({
    where: { vendorId: params.vendorId, countryCode: country },
    select: { city: true },
  });
  if (rows.length === 0) return false;
  return rows.some((r) => cityKey(r.city) === city);
}

/** Merchant-stock offers require warehouse address + at least one coverage city. */
export async function assertMerchantDirectShippingReady(vendorId: string): Promise<void> {
  if (!(await vendorHasWarehouseAddress(vendorId))) {
    throw new VendorCoverageError(
      "WAREHOUSE_ADDRESS_REQUIRED",
      "Add your warehouse address and city in store settings before selling from your stock.",
    );
  }
  const cities = await prisma.vendorDeliveryCity.count({ where: { vendorId } });
  if (cities === 0) {
    throw new VendorCoverageError(
      "COVERAGE_REQUIRED",
      "Add at least one delivery city for direct shipping before selling from your stock.",
    );
  }
}

export class VendorCoverageError extends Error {
  constructor(
    public readonly code: "WAREHOUSE_ADDRESS_REQUIRED" | "COVERAGE_REQUIRED" | "OUTSIDE_COVERAGE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorCoverageError";
  }
}
