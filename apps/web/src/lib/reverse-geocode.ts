/** Client helper — calls our API (Nominatim proxy). Never hit Nominatim from the browser. */

export type ReverseGeocodeResult = {
  street?: string;
  district?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  displayName?: string;
};

export async function reverseGeocodeLatLng(
  lat: string,
  lng: string,
): Promise<ReverseGeocodeResult | null> {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;

  const q = new URLSearchParams({ lat: la.toFixed(6), lng: lo.toFixed(6) });
  const res = await fetch(`/api/v1/public/geocode/reverse?${q}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { result?: ReverseGeocodeResult | null } | null;
  return data?.result ?? null;
}

export function mapsUrlFromLatLng(lat: string, lng: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}
