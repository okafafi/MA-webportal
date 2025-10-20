export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin"; // ← service role client

const json = (s, o) =>
  new Response(JSON.stringify(o, null, 2), {
    status: s,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function GET(req) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const limit = Number(url.searchParams.get("limit") || 200);

  if (!orgId) return json(400, { error: "orgId is required" });

  // 1) Pull missions for this org
  const { data: missions, error: mErr } = await supabaseAdmin
    .from("missions")
    .select(
      [
        "id",
        "org_id",
        "title",
        "store",
        "status",          // ← authoritative if 'Completed'
        "starts_at",
        "expires_at",
        "location",
        "budget",
        "fee",
        "cost",
        "created_at",
      ].join(",")
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (mErr) return json(500, { error: mErr.message });

  const rows = missions ?? [];
  if (rows.length === 0) return json(200, { ok: true, missions: [] });

  // 2) See which missions have a submitted row (treat as Completed)
  const ids = rows.map((r) => r.id);
  const { data: subs, error: sErr } = await supabaseAdmin
    .from("mission_submissions")
    .select("mission_id,status,submitted_at")
    .in("mission_id", ids);

  // Build a quick lookup: any status that looks like "submitted"
  const completedBySubmission = new Set(
    (subs || [])
      .filter(
        (r) =>
          (r?.submitted_at &&
            Number.isFinite(Date.parse(String(r.submitted_at)) || NaN)) ||
          String(r?.status || "").toLowerCase() === "submitted"
      )
      .map((r) => r.mission_id)
  );

  const now = Date.now();

  // 3) Map → final shape + correct status
  const out = rows.map((r) => {
    // If DB says Completed, keep it.
    if (String(r.status || "").toLowerCase() === "completed") {
      return { ...dbRowToWire(r, "db-completed"), status: "Completed" };
    }

    // If we have at least one submitted submission, force Completed.
    if (completedBySubmission.has(r.id)) {
      return { ...dbRowToWire(r, "has-submission"), status: "Completed" };
    }

    // Otherwise derive from time window (legacy behavior)
    const starts = ts(r.starts_at);
    const ends = ts(r.expires_at);
    let status = "Scheduled";
    if (Number.isFinite(starts) && Number.isFinite(ends)) {
      status = now >= starts && now <= ends ? "Now" : now < starts ? "Scheduled" : "Scheduled";
    } else if (Number.isFinite(starts)) {
      status = now >= starts ? "Now" : "Scheduled";
    }

    return { ...dbRowToWire(r, "derived"), status };
  });

  return json(200, { ok: true, missions: out });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = new URL(req.url).searchParams.get("orgId") || body.orgId;
    if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

    const row = {
      org_id: orgId,
      title: body.title || "Untitled Mission",
      store: body.store || null,
      status: body.status === "Now" ? "Now" : "Scheduled",
      starts_at: body.startsAt ? new Date(body.startsAt).toISOString() : new Date().toISOString(),
      expires_at: body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
      location: body.location || null,
      budget: body.budget ?? null,
      fee: body.fee ?? null,
      requires_video: !!body.requiresVideo,
      requires_photos: !!body.requiresPhotos,
      time_on_site_min: Number.isFinite(+body.timeOnSiteMin) ? +body.timeOnSiteMin : 10,
    };

    const { data, error } = await supabaseAdmin.from("missions").insert(row).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// ---- helpers ----
function ts(v) {
  try {
    const n = typeof v === "number" ? v : Date.parse(v);
    return Number.isFinite(n) ? n : NaN;
  } catch {
    return NaN;
  }
}

function dbRowToWire(r, source) {
  // keep wire field names used by your UI
  return {
    id: r.id,
    org_id: r.org_id,
    title: r.title,
    store: r.store,
    startsAt: r.starts_at,
    expiresAt: r.expires_at,
    location: r.location ?? null,
    budget: r.budget ?? null,
    fee: r.fee ?? null,
    cost: r.cost ?? null,
    created_at: r.created_at,
    _status_source: source, // debug breadcrumb (safe to keep)
  };
}
