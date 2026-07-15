import { describe, expect, it } from "vitest";
import {
  adminMayUpdateFulfillmentType,
  vendorMayUpdateFulfillmentType,
} from "@mlm/shared";

describe("fulfillment ownership (Phase IV-d)", () => {
  it("vendor may update Direct and Warehouse B", () => {
    expect(vendorMayUpdateFulfillmentType("DIRECT")).toBe(true);
    expect(vendorMayUpdateFulfillmentType("ON_ORDER")).toBe(true);
    expect(vendorMayUpdateFulfillmentType("FORSEIZ_STOCK")).toBe(false);
  });

  it("admin may update Warehouse A only", () => {
    expect(adminMayUpdateFulfillmentType("FORSEIZ_STOCK")).toBe(true);
    expect(adminMayUpdateFulfillmentType("DIRECT")).toBe(false);
    expect(adminMayUpdateFulfillmentType("ON_ORDER")).toBe(false);
  });
});
