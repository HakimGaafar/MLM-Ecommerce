import { describe, expect, it } from "vitest";
import { ADMIN_SETTLEABLE_ENTRY_TYPES } from "./wallet-settlement.service";

describe("wallet settlement config", () => {
  it("includes affiliate and vendor earning types", () => {
    expect(ADMIN_SETTLEABLE_ENTRY_TYPES).toContain("AFFILIATE_COMMISSION");
    expect(ADMIN_SETTLEABLE_ENTRY_TYPES).toContain("VENDOR_EARNING");
  });
});
