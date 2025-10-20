import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const DISABLED = process.env.NODE_ENV === "production";
export const dynamic = "force-dynamic";

export async function GET(req) {
  if (DISABLED) {
    return NextResponse.json(
      { ok: false, error: "Disabled in production" },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId") || "";
  try {
    const query = supabaseAdmin
      .from("missions")
      .select("*")
      .order("created_at", { ascending: false });
    const { data, error } = orgId
      ? await query.eq("org_id", orgId)
      : await query.limit(20);
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      count: (data || []).length,
      rows: data || [],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
