export type PreferredLanguage = "en" | "ar";

export type CustomerProfileDto = {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  countryCode: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  shipSameAsBilling: boolean;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  shippingCountryCode?: string;
  preferredLanguage: PreferredLanguage;
  createdAt: string;
  updatedAt: string;
};
