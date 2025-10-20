// app/api/app/Completed Missions/route.js
import { supabaseService } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (s, o) =>
  new Response(JSON.stringify(o, null, 2), {
    status: s,
    headers: { "Content-Type": "application/json" },
  });

/**
 * POST  /api/app/Completed Missions
 * Body (JSON):
 * {
 *   missionId: string (uuid),
 *   agentId: string,
 *   startedAt?: number|ISO,
 *   submittedAt?: number|ISO,
 *   answers: [ { itemIndex, text?, photos?, videos?, timerSec? } ],
 *   gps?: { lat, lng, accuracy? },
 *   deviceMeta?: { ... }
 * }
 *
 * Behavior:
 * - Looks up mission by id to derive org_id (so client does NOT pass orgId)
 * - Inserts into 'Completed Missions' table
 * - Returns { id }
 */
export async function POST(req) {
  try {
    const s = supabaseService();
    const body = await req.json().catch(() => ({}));

    const {
      missionId,
      agentId,
      startedAt = null,
      submittedAt = Date.now(),
      answers,
      gps = null,
      deviceMeta = null,
    } = body || {};

    if (!missionId) return json(400, { error: "missionId is required" });
    if (!agentId) return json(400, { error: "agentId is required" });
    if (!Array.isArray(answers))
      return json(400, { error: "answers[] is required" });

    // 1) Get mission to obtain org_id (and to validate existence)
    const { data: mission, error: mErr } = await s
      .from("missions")
      .select("id, org_id")
      .eq("id", missionId)
      .single();

    if (mErr || !mission) {
      return json(404, { error: "Mission not found", details: mErr });
    }

    // 2) Insert submission
    const payload = {
      org_id: mission.org_id,
      mission_id: missionId,
      agent_id: String(agentId),
      started_at: startedAt ? new Date(startedAt) : null,
      submitted_at: new Date(submittedAt),
      answers, // JSONB
      gps, // JSONB
      device_meta: deviceMeta, // JSONB
      status: "Submitted",
    };

    const { data: ins, error: iErr } = await s
      .from("Completed Missions")
      .insert(payload)
      .select("id")
      .single();

    if (iErr) return json(500, { error: "Insert failed", details: iErr });

    return json(200, { ok: true, id: ins.id });
  } catch (e) {
    return json(500, { error: "Exception", message: String(e?.message || e) });
  }
}

/**
 * GET /api/app/Completed Missions?orgId=<uuid>&limit=20
 * Debug/list endpoint (useful during dev)
 */
export async function GET(req) {
  const s = supabaseService();
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const limit = Math.min(Number(searchParams.get("limit") || 20), 100);

  if (!orgId) return json(400, { error: "orgId is required" });

  const { data, error } = await s
    .from("Completed Missions")
    .select("id, mission_id, agent_id, submitted_at, status")
    .eq("org_id", orgId)
    .order("submitted_at", { ascending: false })
    .limit(limit);

  if (error) return json(500, { error: error.message });

  return json(200, { ok: true, completedMissions: data });
}
