// app/api/geocode/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return NextResponse.json({ error: "Missing MAPBOX token" }, { status: 500 });

  // Accept either plain "address" or structured "addressParts"
  const parts = body.addressParts || {};
  const address =
    body.address ||
    [parts.line1, parts.city, parts.region, parts.postalCode, parts.country]
      .filter(Boolean)
      .join(", ");

  if (!address || !address.trim()) {
    return NextResponse.json({ error: "Address is empty" }, { status: 400 });
  }

  // Optional proximity bias (lng,lat) to improve results near a known center
  const proximity = body.proximity && Number.isFinite(body.proximity.lng) && Number.isFinite(body.proximity.lat)
    ? `${body.proximity.lng},${body.proximity.lat}`
    : undefined;

  const params = new URLSearchParams({
    access_token: token,
    autocomplete: "true",
    limit: "1",
    types: "address,place,poi,neighborhood,locality",
  });
  if (proximity) params.set("proximity", proximity);
  if (parts.country) params.set("country", parts.country); // 2-letter ISO (e.g., EG, US) if you have it

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return NextResponse.json({ error: "Geocode failed" }, { status: 502 });
  const js = await res.json();

  const f = js?.features?.[0];
  if (!f) return NextResponse.json({ error: "No result" }, { status: 404 });

  const [lng, lat] = f.center || [];
  return NextResponse.json({
    lat, lng,
    formatted: f.place_name,
    raw: f,
  });
}