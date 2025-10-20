import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (s, o) =>
  new Response(JSON.stringify(o, null, 2), {
    status: s,
    headers: { "Content-Type": "application/json" },
  });

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  if (!orgId) return json(400, { error: "orgId is required" });

  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("id, org_id, mission_id, type, status, generated_at, title, pdf_url, kpis, meta")
    .eq("org_id", orgId)
    .order("generated_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) return json(500, { error: error.message });

  const reports = (data || []).map((r) => ({
    id: r.id,
    org_id: r.org_id,
    mission_id: r.mission_id,
    type: r.type,
    status: r.status,
    generated_at: r.generated_at,
    title: r.title,
    pdf_url: r.pdf_url,
    kpis: r.kpis ?? null,
    meta: r.meta ?? {},
  }));

  return json(200, { ok: true, reports });
}
