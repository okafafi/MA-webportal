// app/api/revgeocode/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { lat, lng } = body || {};
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return NextResponse.json({ error: "Missing MAPBOX token" }, { status: 500 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  const params = new URLSearchParams({
    access_token: token,
    limit: "1",
  });
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return NextResponse.json({ error: "Reverse geocode failed" }, { status: 502 });

  const js = await res.json();
  const f = js?.features?.[0];
  if (!f) return NextResponse.json({ error: "No result" }, { status: 404 });

  // Pull common fields
  const ctx = (f.context || []).reduce((acc, c) => {
    acc[c.id.split(".")[0]] = c.text;
    return acc;
  }, {});
  const place = f.place_name || "";
  const addressParts = {
    line1: f.address ? `${f.address} ${f.text}` : f.text,
    city: ctx.place || ctx.locality || ctx.district || "",
    region: ctx.region || "",
    postalCode: ctx.postcode || "",
    country: ctx.country || "",
  };

  return NextResponse.json({
    formatted: place,
    addressParts,
  });
}