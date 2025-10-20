// app/api/completed/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const limit = Number(searchParams.get("limit") || 50);

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .rpc("completed_missions_for_portal", { org: orgId, lim: limit });

    if (error) {
      console.error("[/api/completed] RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let items = Array.isArray(data) ? [...data] : [];

    const needsTitles = items.some(
      (row) => !row?.mission_title && !row?.mission_name && !row?.title
    );
    if (needsTitles) {
      const missionIds = Array.from(
        new Set(items.map((row) => row?.mission_id).filter(Boolean))
      );

      if (missionIds.length) {
        const { data: missions, error: missionsErr } = await supabaseAdmin
          .from("missions")
          .select("id, title")
          .in("id", missionIds);

        if (missionsErr) {
          console.warn("[/api/completed] missions lookup failed:", missionsErr);
        } else if (missions?.length) {
          const titleById = new Map(
            missions.map((m) => [m.id, m.title || null])
          );
          items = items.map((row) => {
            if (row?.mission_title) return row;
            const missionTitle =
              titleById.get(row?.mission_id) ??
              row?.mission_name ??
              row?.title ??
              null;
            return missionTitle
              ? { ...row, mission_title: missionTitle }
              : row;
          });
        }
      }
    }

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[/api/completed] handler error:", e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
