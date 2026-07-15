import { describe, expect, it } from "vitest";
import { ContactInquiryCreateSchema } from "@mlm/shared";

const valid = {
  firstName: "Hakim",
  lastName: "Gaafar",
  email: "customer@example.com",
  message: "I need help with an order that has not arrived.",
  website: "",
};

describe("ContactInquiryCreateSchema", () => {
  it("normalizes safe bilingual contact data", () => {
    const parsed = ContactInquiryCreateSchema.parse({
      ...valid,
      firstName: "  حكيم  ",
      lastName: "جعفر",
      email: "  CUSTOMER@Example.COM ",
    });

    expect(parsed.firstName).toBe("حكيم");
    expect(parsed.email).toBe("customer@example.com");
  });

  it.each([
    ["script markup", { ...valid, message: "<script>alert(1)</script> Please help me." }],
    ["HTML image", { ...valid, message: "<img src=x onerror=alert(1)> Please help." }],
    ["control characters", { ...valid, message: "Order issue\u0000 with invalid data." }],
    ["invalid name", { ...valid, firstName: "Robert'); DROP TABLE users;--" }],
    ["unknown fields", { ...valid, role: "SUPER_ADMIN" }],
  ])("rejects %s", (_label, input) => {
    expect(ContactInquiryCreateSchema.safeParse(input).success).toBe(false);
  });

  it("rejects oversized messages", () => {
    expect(
      ContactInquiryCreateSchema.safeParse({
        ...valid,
        message: "a".repeat(4001),
      }).success,
    ).toBe(false);
  });
});
