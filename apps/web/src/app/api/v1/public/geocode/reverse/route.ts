import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, getClientIp } from "@/lib/security";

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  region?: string;
  postcode?: string;
  country_code?: string;
};

/** Server-side Nominatim proxy — browser calls fail CORS if hit directly. */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`geocode-reverse:${ip}`, 30, 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const latRaw = request.nextUrl.searchParams.get("lat")?.trim() ?? "";
  const lngRaw = request.nextUrl.searchParams.get("lng")?.trim() ?? "";
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat.toFixed(6));
  url.searchParams.set("lon", lng.toFixed(6));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "FourcesMLM/1.0 (vendor-onboarding; contact=support@localhost)",
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Geocode lookup failed." }, { status: 502 });
    }

    const json = (await res.json().catch(() => null)) as {
      display_name?: string;
      address?: NominatimAddress;
    } | null;
    if (!json?.address) {
      return NextResponse.json({ result: null }, { headers: { "Cache-Control": "no-store" } });
    }

    const a = json.address;
    const road = a.road || a.pedestrian || "";
    const house = a.house_number ? `${a.house_number} ` : "";
    const street = `${house}${road}`.trim() || undefined;

    return NextResponse.json(
      {
        result: {
          street,
          district: a.neighbourhood || a.suburb || a.city_district || a.district || undefined,
          city: a.city || a.town || a.village || a.municipality || undefined,
          region: a.state || a.region || a.county || undefined,
          postalCode: a.postcode || undefined,
          countryCode: a.country_code?.toUpperCase(),
          displayName: json.display_name,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Geocode lookup failed." }, { status: 502 });
  }
}
