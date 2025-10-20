// app/api/submissions/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseService } from "../../../lib/supabase";

// helper
const json = (s, o) => new Response(JSON.stringify(o, null, 2), {
  status: s, headers: { "Content-Type": "application/json" }
});

/**
 * Expected body:
 * {
 *   missionId: "MSN-123",
 *   orgId: "ORG-1",
 *   agentId: "AGENT-9",
 *   comment?: "overall note",
 *   items: [
 *     // examples of supported types:
 *     { answer_type:"YN",     checklist_item_id:"...", yes_no:true },
 *     { answer_type:"COMMENT",checklist_item_id:"...", comment:"..."},
 *     { answer_type:"TIMER",  checklist_item_id:"...", timer_seconds:123 },
 *     { answer_type:"RATING", checklist_item_id:"...", rating:4 },
 *     { answer_type:"PHOTO",  checklist_item_id:"...", photo_attachment_id:"att-id" },
 *     { answer_type:"VIDEO",  checklist_item_id:"...", video_attachment_id:"att-id" },
 *     { answer_type:"PHOTO",  checklist_item_id:"...", order_photo_attachment_id:"att-id" }
 *   ]
 * }
 */
export async function POST(req) {
  const stage = { step: "start" };
  try {
    const body = await req.json().catch(() => ({}));
    const missionId = body.missionId;
    const orgId     = body.orgId;
    const agentId   = body.agentId;
    const items     = Array.isArray(body.items) ? body.items : [];
    const comment   = body.comment ?? null;

    if (!missionId || !orgId || !agentId) {
      return json(400, { error: "missionId, orgId, agentId are required", stage });
    }

    const s = supabaseService();

    // 1) create submission row
    stage.step = "insert-submission";
    const { data: sub, error: subErr } = await s
       .from("mission_submissions")
       .insert({
         mission_id: missionId,
         org_id: orgId,
         agent_id: agentId,
         comment,
         status: "submitted",              // ← normalize
         submitted_at: new Date().toISOString()
       })
      .select("*")
      .single();

    if (subErr) return json(500, { error: subErr.message, stage });

    // 2) normalize + validate items and insert
    stage.step = "insert-items";
    const rows = [];
    for (const it of items) {
      const t = (it.answer_type || "").toUpperCase();

      // Only allow known types
      if (!["YN","COMMENT","TIMER","RATING","PHOTO","VIDEO"].includes(t)) continue;

      const row = {
        submission_id: sub.id,
        mission_id: missionId,
        checklist_item_id: it.checklist_item_id || null,
        answer_type: t,
        yes_no: null,
        comment: null,
        timer_seconds: null,
        rating: null,
        photo_attachment_id: it.photo_attachment_id || it.photoId || null,
        order_photo_attachment_id: it.order_photo_attachment_id || null,
        video_attachment_id: it.video_attachment_id || it.videoId || null,
      };

      if (t === "YN")       row.yes_no = !!it.yes_no;
      if (t === "COMMENT")  row.comment = (it.comment || "").toString();
      if (t === "TIMER")    row.timer_seconds = Number.isFinite(+it.timer_seconds) ? +it.timer_seconds : null;

      if (t === "RATING") {
        // clamp to 1..5 and store
        const raw = it.rating ?? it.rating_value;
        const n = Math.round(Number(raw));
        const clamped = Math.min(5, Math.max(1, n || 0)) || null;
        row.rating = clamped;
      }

      rows.push(row);
    }

    if (rows.length) {
      const { error: itemsErr } = await s.from("mission_submission_items").insert(rows);
      if (itemsErr) return json(500, { error: itemsErr.message, stage });
    }

    // 3) optionally mark mission “Completed” (up to you)
    stage.step = "maybe-update-mission";
    await s.from("missions").update({ status: "Completed" }).eq("id", missionId);

    return json(200, { ok: true, submissionId: sub.id, items: rows.length });
  } catch (e) {
    return json(500, { error: String(e?.message || e), stage });
  }
}
