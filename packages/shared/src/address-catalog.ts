/** Country-specific address catalogs for SA / OM / EG forms. */

export const ADDRESS_COUNTRY_CODES = ["SA", "OM", "EG"] as const;
export type AddressCountryCode = (typeof ADDRESS_COUNTRY_CODES)[number];

export function isAddressCountryCode(value: string): value is AddressCountryCode {
  return (ADDRESS_COUNTRY_CODES as readonly string[]).includes(value);
}

/** Major cities — used as dropdown options; "Other" allows free text. */
export const ADDRESS_CITIES: Record<AddressCountryCode, readonly string[]> = {
  SA: [
    "Riyadh",
    "Jeddah",
    "Dammam",
    "Khobar",
    "Dhahran",
    "Mecca",
    "Medina",
    "Taif",
    "Tabuk",
    "Abha",
    "Khamis Mushait",
    "Buraidah",
    "Hail",
    "Najran",
    "Jazan",
    "Yanbu",
    "Jubail",
  ],
  OM: [
    "Muscat",
    "Seeb",
    "Bawshar",
    "Muttrah",
    "Al Amarat",
    "Sohar",
    "Salalah",
    "Nizwa",
    "Sur",
    "Ibri",
    "Barka",
    "Rustaq",
    "Saham",
  ],
  EG: [
    "Cairo",
    "Giza",
    "Alexandria",
    "Sharm El Sheikh",
    "Hurghada",
    "Mansoura",
    "Tanta",
    "Asyut",
    "Ismailia",
    "Port Said",
    "Suez",
    "Luxor",
    "Aswan",
    "Zagazig",
  ],
};

/** Governorates / regions for OM and EG. */
export const ADDRESS_GOVERNORATES: Record<"OM" | "EG", readonly string[]> = {
  OM: [
    "Muscat",
    "Dhofar",
    "Musandam",
    "Al Buraimi",
    "Ad Dakhiliyah",
    "Al Batinah North",
    "Al Batinah South",
    "Ash Sharqiyah North",
    "Ash Sharqiyah South",
    "Ad Dhahirah",
    "Al Wusta",
  ],
  EG: [
    "Cairo",
    "Giza",
    "Alexandria",
    "Qalyubia",
    "Dakahlia",
    "Sharqia",
    "Gharbia",
    "Monufia",
    "Beheira",
    "Kafr El Sheikh",
    "Damietta",
    "Port Said",
    "Ismailia",
    "Suez",
    "Red Sea",
    "South Sinai",
    "North Sinai",
    "Fayoum",
    "Beni Suef",
    "Minya",
    "Asyut",
    "Sohag",
    "Qena",
    "Luxor",
    "Aswan",
    "New Valley",
    "Matrouh",
  ],
};

export type AddressFieldKey =
  | "governorate"
  | "city"
  | "neighborhood"
  | "street"
  | "building"
  | "postalCode"
  | "shortNationalAddress"
  | "fullAddress";

/** Required fields by country (street maps to addressLine1). */
export const ADDRESS_REQUIRED_FIELDS: Record<AddressCountryCode, readonly AddressFieldKey[]> = {
  SA: ["city", "neighborhood", "street", "postalCode"],
  OM: ["governorate", "city", "neighborhood", "postalCode"],
  EG: ["governorate", "city", "neighborhood", "street", "building", "postalCode"],
};
