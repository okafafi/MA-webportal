// app/api/missions/[id]/route.js
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const toNum = (v, d = 0) => (v == null ? d : Number(v));
const toISO = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);

function mapMission(row) {
  const loc = row.location || {};
  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title || "Untitled Mission",
    store: row.store || "",
    status: row.status || "Scheduled",
    startsAt: row.starts_at ? Date.parse(row.starts_at) : 0,
    expiresAt: row.expires_at ? Date.parse(row.expires_at) : 0,
    location: {
      address: loc.address || "",
      lat: loc.lat != null ? Number(loc.lat) : null,
      lng: loc.lng != null ? Number(loc.lng) : null,
      radiusM: Number.isFinite(Number(loc.radiusM)) ? Number(loc.radiusM) : 150,
    },
    // we don’t load checklist here (use /checklist endpoint)
    checklist: [],
    budget: toNum(row.budget),
    fee: toNum(row.fee),
    cost: toNum(row.cost), // DB-managed
    requiresVideo: !!row.requires_video,
    requiresPhotos: !!row.requires_photos,
    timeOnSiteMin: toNum(row.time_on_site_min),
    templateId: row.template_id || null,
    createdAt: row.created_at || null,
  };
}

// ---------- GET /api/missions/[id] ----------
export async function GET(_req, { params }) {
  try {
    const id = String(params?.id || "");
    const { data, error } = await supabaseAdmin
      .from("missions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ mission: mapMission(data) });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// ---------- PUT /api/missions/[id] ----------
export async function PUT(req, { params }) {
  try {
    const id = String(params?.id || "");
    const body = await req.json().catch(() => ({}));

    const loc = body.location || {};
    // Build an update that matches the Supabase schema
    const patch = {
      title: body.title,
      store: body.store,
      status: body.status, // allow switching Now/Scheduled
      starts_at: toISO(body.startsAt),
      expires_at: toISO(body.expiresAt),
      location: {
        address: body.address || loc.address || "",
        lat: loc.lat != null ? Number(loc.lat) : null,
        lng: loc.lng != null ? Number(loc.lng) : null,
        radiusM: Number.isFinite(Number(loc.radiusM)) ? Number(loc.radiusM) : 150,
      },
      budget: toNum(body.budget),
      fee: toNum(body.fee),
      // DO NOT send cost; DB manages it (default/trigger)
      requires_video: !!body.requiresVideo,
      requires_photos: !!body.requiresPhotos,
      time_on_site_min: toNum(body.timeOnSiteMin),
      template_id: body.templateId ?? null,
    };

    // remove undefined keys so we don’t overwrite with nulls accidentally
    for (const k of Object.keys(patch)) {
      if (patch[k] === undefined) delete patch[k];
    }

    const { data, error } = await supabaseAdmin
      .from("missions")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, mission: mapMission(data) });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// ---------- DELETE /api/missions/[id] ----------
export async function DELETE(_req, { params }) {
  const id = String(params?.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    // Best-effort: remove any checklist rows that might still reference either column
    const delChecklist1 = await supabaseAdmin
      .from("mission_checklist_items")
      .delete()
      .eq("mission_id", id);
    if (delChecklist1.error) console.warn("[DELETE] checklist by mission_id:", delChecklist1.error.message);

    const delChecklist2 = await supabaseAdmin
      .from("mission_checklist_items")
      .delete()
      .eq("mission_id_uuid", id);
    if (delChecklist2.error) console.warn("[DELETE] checklist by mission_id_uuid:", delChecklist2.error.message);

    // Optional: if you have submissions/answers tables, clean them too
    // await supabaseAdmin.from("mission_answers").delete().eq("mission_id", id);
    // await supabaseAdmin.from("mission_submissions").delete().eq("mission_id", id);

    // Delete the mission row (will also cascade if you set FK ON DELETE CASCADE)
    const { error: delMissionErr } = await supabaseAdmin
      .from("missions")
      .delete()
      .eq("id", id);

    if (delMissionErr) {
      return NextResponse.json({ error: delMissionErr.message }, { status: 500 });
    }

    // Optional: clean Storage (ignore errors)
    try {
      const bucket = "mission-media";
      const root = `mission/${id}`;
      // list level-1
      const { data: level1 } = await supabaseAdmin.storage.from(bucket).list(root, { limit: 1000 });
      if (Array.isArray(level1)) {
        for (const l1 of level1) {
          const p1 = `${root}/${l1.name}`;
          const { data: level2 } = await supabaseAdmin.storage.from(bucket).list(p1, { limit: 1000 });
          if (Array.isArray(level2)) {
            for (const l2 of level2) {
              const p2 = `${p1}/${l2.name}`;
              const { data: files } = await supabaseAdmin.storage.from(bucket).list(p2, { limit: 1000 });
              const paths = (files || []).map(f => `${p2}/${f.name}`);
              if (paths.length) {
                const { error: remErr } = await supabaseAdmin.storage.from(bucket).remove(paths);
                if (remErr) console.warn("[DELETE] storage remove err:", remErr.message);
              }
            }
          }
        }
        // finally try to remove the top-level folder (will be no-op if non-empty)
        await supabaseAdmin.storage.from(bucket).remove([root]);
      }
    } catch (e) {
      console.warn("[DELETE] storage cleanup warn:", e?.message || e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
