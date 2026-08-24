"use client";

import { useEffect, useRef, useState } from "react";
import type { AddressCountryCode } from "@mlm/shared";
import type { LatLngExpression, Map as LeafletMap, Marker } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./address-map-picker.css";

const DEFAULT_CENTER: Record<AddressCountryCode, [number, number]> = {
  SA: [24.7136, 46.6753],
  OM: [23.588, 58.3829],
  EG: [30.0444, 31.2357],
};

const DEFAULT_ZOOM = 12;
const COORD_EPSILON = 0.000001;
const EXTERNAL_SYNC_DEBOUNCE_MS = 450;

/** Stable pin icon — avoids broken Leaflet default asset paths in Next.js bundles. */
const MAP_PIN_ICON = L.divIcon({
  className: "address-map-picker__pin",
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="26" height="39" aria-hidden="true" focusable="false"><path fill="var(--primary, #2563eb)" stroke="#fff" stroke-width="1.25" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0zm0 16.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"/></svg>`,
  iconSize: [26, 39],
  iconAnchor: [13, 39],
});

function parseCoord(value: string, fallback: number): number {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : fallback;
}

function isValidCoordPair(lat: string, lng: string): boolean {
  const la = Number(lat.trim());
  const lo = Number(lng.trim());
  return (
    lat.trim() !== "" &&
    lng.trim() !== "" &&
    Number.isFinite(la) &&
    Number.isFinite(lo) &&
    Math.abs(la) <= 90 &&
    Math.abs(lo) <= 180
  );
}

function coordsMatch(a: LatLngExpression, b: LatLngExpression): boolean {
  const ax = Array.isArray(a) ? a[0] : a.lat;
  const ay = Array.isArray(a) ? a[1] : a.lng;
  const bx = Array.isArray(b) ? b[0] : b.lat;
  const by = Array.isArray(b) ? b[1] : b.lng;
  return Math.abs(ax - bx) < COORD_EPSILON && Math.abs(ay - by) < COORD_EPSILON;
}

function formatCoord(value: number): string {
  return value.toFixed(6);
}

export default function AddressMapPicker({
  countryCode,
  latitude,
  longitude,
  onChange,
}: {
  countryCode: AddressCountryCode;
  latitude: string;
  longitude: string;
  onChange: (lat: string, lng: string) => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef<{ lat: string; lng: string } | null>(null);
  const countryRef = useRef(countryCode);
  const [isVisible, setIsVisible] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  onChangeRef.current = onChange;
  countryRef.current = countryCode;

  /** Defer map creation until the field scrolls into view — keeps the address form snappy. */
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px 0px", threshold: 0.01 },
    );

    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  /** Create the map once; tear down only on unmount. */
  useEffect(() => {
    if (!isVisible || !mapContainerRef.current || mapRef.current) return;

    const [defaultLat, defaultLng] = DEFAULT_CENTER[countryRef.current];
    const lat = parseCoord(latitude, defaultLat);
    const lng = parseCoord(longitude, defaultLng);

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      maxNativeZoom: 19,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 2,
    }).addTo(map);

    const marker = L.marker([lat, lng], {
      draggable: true,
      autoPan: true,
      icon: MAP_PIN_ICON,
    }).addTo(map);

    const emitPosition = (position: L.LatLng, animate = false) => {
      const latStr = formatCoord(position.lat);
      const lngStr = formatCoord(position.lng);
      lastEmittedRef.current = { lat: latStr, lng: lngStr };
      onChangeRef.current(latStr, lngStr);
      if (animate) {
        map.panTo(position, { animate: true, duration: 0.25 });
      }
    };

    marker.on("dragend", () => {
      emitPosition(marker.getLatLng());
    });

    map.on("click", (event) => {
      marker.setLatLng(event.latlng);
      emitPosition(event.latlng);
    });

    const container = mapContainerRef.current;
    const enableWheel = () => map.scrollWheelZoom.enable();
    const disableWheel = () => map.scrollWheelZoom.disable();
    container.addEventListener("mouseenter", enableWheel);
    container.addEventListener("mouseleave", disableWheel);
    container.addEventListener("focusin", enableWheel);
    container.addEventListener("focusout", disableWheel);

    map.whenReady(() => {
      map.invalidateSize();
      setMapReady(true);
    });

    mapRef.current = map;
    markerRef.current = marker;

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            map.invalidateSize({ animate: false });
          })
        : null;
    resizeObserver?.observe(mapContainerRef.current);

    return () => {
      resizeObserver?.disconnect();
      container.removeEventListener("mouseenter", enableWheel);
      container.removeEventListener("mouseleave", disableWheel);
      container.removeEventListener("focusin", enableWheel);
      container.removeEventListener("focusout", disableWheel);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional single mount after visibility
  }, [isVisible]);

  /** Recenter when country changes (no full map rebuild). */
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const [defaultLat, defaultLng] = DEFAULT_CENTER[countryCode];
    const hasCoords = isValidCoordPair(latitude, longitude);
    const nextLat = hasCoords ? parseCoord(latitude, defaultLat) : defaultLat;
    const nextLng = hasCoords ? parseCoord(longitude, defaultLng) : defaultLng;
    const next: LatLngExpression = [nextLat, nextLng];

    if (coordsMatch(marker.getLatLng(), next)) return;

    marker.setLatLng(next);
    map.flyTo(next, DEFAULT_ZOOM, { duration: 0.35, easeLinearity: 0.25 });
  }, [countryCode]);

  /** Sync marker from lat/lng inputs — debounced, skips echoes from map drags/clicks. */
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !mapReady) return;

    if (
      lastEmittedRef.current &&
      lastEmittedRef.current.lat === latitude.trim() &&
      lastEmittedRef.current.lng === longitude.trim()
    ) {
      return;
    }

    const applyExternalCoords = () => {
      const [defaultLat, defaultLng] = DEFAULT_CENTER[countryRef.current];
      const hasCoords = isValidCoordPair(latitude, longitude);
      const nextLat = hasCoords ? parseCoord(latitude, defaultLat) : defaultLat;
      const nextLng = hasCoords ? parseCoord(longitude, defaultLng) : defaultLng;
      const next: LatLngExpression = [nextLat, nextLng];

      if (coordsMatch(marker.getLatLng(), next)) return;

      marker.setLatLng(next);
      if (hasCoords) {
        map.setView(next, map.getZoom(), { animate: false });
      }
    };

    if (!latitude.trim() && !longitude.trim()) {
      applyExternalCoords();
      return;
    }

    if (!isValidCoordPair(latitude, longitude)) return;

    const timer = window.setTimeout(applyExternalCoords, EXTERNAL_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [latitude, longitude, mapReady]);

  return (
    <div ref={shellRef} className="address-map-picker">
      <div
        ref={mapContainerRef}
        className="address-map-picker__canvas"
        role="application"
        aria-label="Map pin picker"
        tabIndex={0}
      />
      {!isVisible ? (
        <div className="address-map-picker__placeholder" aria-hidden="true">
          <span className="address-map-picker__placeholder-text">Loading map…</span>
        </div>
      ) : null}
    </div>
  );
}
