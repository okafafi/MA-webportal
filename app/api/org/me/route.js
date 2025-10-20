import { supabaseService } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (s, o) => new Response(JSON.stringify(o, null, 2), {
  status: s,
  headers: { "Content-Type": "application/json" }
});

// Heuristics (priority order):
// 1) ?orgId=UUID query param (useful for deep links)
// 2) process.env.NEXT_PUBLIC_DEFAULT_ORG_ID
// 3) Most recent org_id seen in missions
// 4) Most recent org_id seen in reports
export async function GET(req) {
  try {
    const s = supabaseService();
    const { searchParams, host } = new URL(req.url);

    // 1) explicit query
    const qOrg = searchParams.get("orgId");
    if (qOrg) return json(200, { orgId: qOrg, source: "query" });

    // 2) env default
    const envOrg = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || process.env.DEMO_ORG_ID;
    if (envOrg) return json(200, { orgId: envOrg, source: "env" });

    // 3) latest in missions
    const m = await s
      .from("missions")
      .select("org_id, starts_at")
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (m?.data?.org_id) return json(200, { orgId: m.data.org_id, source: "missions" });

    // 4) latest in reports
    const r = await s
      .from("reports")
      .select("org_id, generated_at")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (r?.data?.org_id) return json(200, { orgId: r.data.org_id, source: "reports" });

    // No luck
    return json(404, { error: "org not found", hint: "Set NEXT_PUBLIC_DEFAULT_ORG_ID in .env.local" });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}