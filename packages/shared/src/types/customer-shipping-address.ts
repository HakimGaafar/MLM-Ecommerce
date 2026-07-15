export type CustomerShippingAddressDto = {
  id: string;
  userId: string;
  label?: string;
  recipientName: string;
  phone: string;
  countryCode: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
