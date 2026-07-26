import { describe, expect, it } from "vitest";
import {
  FOURCES_WAREHOUSE_IDS,
  inferShippingPackageType,
  primaryMarketFromCountry,
  primaryMarketIdFromCountry,
} from "@mlm/shared";

describe("commerce-fulfillment helpers", () => {
  it("maps vendor country to primary market", () => {
    expect(primaryMarketFromCountry("SA")).toBe("SA");
    expect(primaryMarketFromCountry("OM")).toBe("OM");
    expect(primaryMarketFromCountry("EG")).toBe("EG");
    expect(primaryMarketFromCountry("US")).toBe("GLOBAL");
    expect(primaryMarketIdFromCountry("OM")).toBe("market_om");
    expect(primaryMarketIdFromCountry("AE")).toBe("market_global");
  });

  it("exposes stable warehouse ids", () => {
    expect(FOURCES_WAREHOUSE_IDS.SA).toBe("warehouse_sa");
    expect(FOURCES_WAREHOUSE_IDS.EG).toBe("warehouse_eg");
  });

  it.each([
    [
      "FOURCES domestic",
      {
        stockLocation: "FOURCES_WAREHOUSE" as const,
        warehouseCountry: "SA",
        customerCountry: "SA",
        merchantCountry: "OM",
      },
      "FOURCES_DOMESTIC",
    ],
    [
      "FOURCES international",
      {
        stockLocation: "FOURCES_WAREHOUSE" as const,
        warehouseCountry: "SA",
        customerCountry: "JO",
        merchantCountry: "OM",
      },
      "FOURCES_INTERNATIONAL",
    ],
    [
      "merchant domestic",
      {
        stockLocation: "MERCHANT" as const,
        customerCountry: "OM",
        merchantCountry: "OM",
      },
      "MERCHANT_DOMESTIC",
    ],
    [
      "merchant international",
      {
        stockLocation: "MERCHANT" as const,
        customerCountry: "SA",
        merchantCountry: "OM",
      },
      "MERCHANT_INTERNATIONAL",
    ],
  ])("infers %s", (_label, input, expected) => {
    expect(inferShippingPackageType(input)).toBe(expected);
  });
});
