// app/api/staticmap/route.js
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const w = Math.min(800, Math.max(200, Number(searchParams.get("w") || 640)));
  const h = Math.min(800, Math.max(150, Number(searchParams.get("h") || 320)));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response("Bad coords", { status: 400 });
  }

  const token = process.env.MAPBOX_TOKEN;
  if (!token) return new Response("Missing MAPBOX_TOKEN", { status: 500 });

  // Mapbox Static Images API with a small red pin
  const style = "light-v11"; // you can switch to "streets-v12" if you prefer
  const marker = `pin-s+ff0000(${lng},${lat})`;
  const url = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${marker}/${lng},${lat},15,0/${w}x${h}@2x?access_token=${token}`;

  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) return new Response("Static map fetch failed", { status: 502 });

  const buf = await resp.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" }
  });
}