import type { CustomerProfileDto, CustomerShippingAddressDto } from "@mlm/shared";

export class ShippingProfileError extends Error {
  constructor(
    public readonly code: "INCOMPLETE_SHIPPING_PROFILE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ShippingProfileError";
  }
}

/** Saved delivery row has everything needed to ship an order. */
export function isSavedShippingAddressComplete(addr: CustomerShippingAddressDto): boolean {
  return Boolean(
    addr.recipientName?.trim() &&
      addr.phone?.trim() &&
      addr.countryCode?.trim().length === 2 &&
      addr.city?.trim() &&
      addr.postalCode?.trim() &&
      addr.addressLine1?.trim(),
  );
}

export function assertProfileReadyForCheckout(profile: CustomerProfileDto | null): asserts profile is CustomerProfileDto {
  if (!profile) {
    throw new ShippingProfileError("INCOMPLETE_SHIPPING_PROFILE", "Complete your profile before checkout.");
  }
  if (!profile.phone?.trim()) {
    throw new ShippingProfileError("INCOMPLETE_SHIPPING_PROFILE", "Add a phone number for delivery.");
  }
  if (!profile.countryCode?.trim() || profile.countryCode.trim().length !== 2) {
    throw new ShippingProfileError("INCOMPLETE_SHIPPING_PROFILE", "Add a valid country code.");
  }
  if (!profile.city?.trim()) {
    throw new ShippingProfileError("INCOMPLETE_SHIPPING_PROFILE", "Add your city.");
  }
  if (!profile.postalCode?.trim()) {
    throw new ShippingProfileError("INCOMPLETE_SHIPPING_PROFILE", "Add your postal code.");
  }
  if (!profile.addressLine1?.trim()) {
    throw new ShippingProfileError("INCOMPLETE_SHIPPING_PROFILE", "Add your street address.");
  }
  if (profile.shipSameAsBilling === false) {
    if (!profile.shippingAddressLine1?.trim()) {
      throw new ShippingProfileError("INCOMPLETE_SHIPPING_PROFILE", "Add the shipping street address.");
    }
    if (!profile.shippingCity?.trim()) {
      throw new ShippingProfileError("INCOMPLETE_SHIPPING_PROFILE", "Add the shipping city.");
    }
    if (!profile.shippingPostalCode?.trim()) {
      throw new ShippingProfileError("INCOMPLETE_SHIPPING_PROFILE", "Add the shipping postal code.");
    }
    if (!profile.shippingCountryCode?.trim() || profile.shippingCountryCode.trim().length !== 2) {
      throw new ShippingProfileError("INCOMPLETE_SHIPPING_PROFILE", "Add the shipping country code.");
    }
  }
}

export function buildShippingSnapshotFromProfile(profile: CustomerProfileDto, recipientName: string) {
  const phone = profile.phone!.trim();
  const name = recipientName.trim();
  if (profile.shipSameAsBilling !== false) {
    return {
      shippingRecipientName: name,
      shippingPhone: phone,
      shippingCountryCode: profile.countryCode.trim(),
      shippingCity: profile.city!.trim(),
      shippingPostalCode: profile.postalCode!.trim(),
      shippingAddressLine1: profile.addressLine1!.trim(),
      shippingAddressLine2: profile.addressLine2?.trim() || null,
    };
  }
  return {
    shippingRecipientName: name,
    shippingPhone: phone,
    shippingCountryCode: profile.shippingCountryCode!.trim(),
    shippingCity: profile.shippingCity!.trim(),
    shippingPostalCode: profile.shippingPostalCode!.trim(),
    shippingAddressLine1: profile.shippingAddressLine1!.trim(),
    shippingAddressLine2: profile.shippingAddressLine2?.trim() || null,
  };
}
