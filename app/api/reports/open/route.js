// app/api/reports/open/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const reportId  = searchParams.get("reportId");
    const missionId = searchParams.get("missionId");
    const orgId     = searchParams.get("orgId") || null;

    if (!idParam && !reportId && !missionId) {
      return json(400, { error: "id, reportId or missionId is required" });
    }

    // 0) Ensure service client + env
    const s = supabaseAdmin;

    const redirectForUrl = async (rawUrl) => {
      if (/^https?:\/\//i.test(rawUrl)) {
        return NextResponse.redirect(rawUrl, { status: 302 });
      }

      const bucket = "reports";
      let path = String(rawUrl || "").replace(/^\/+/, "");
      path = path.replace(/^public\//, "");
      path = path.replace(/^storage\//, "");
      path = path.replace(/^reports\//, "");

      if (!path || path.endsWith("/")) {
        return json(400, {
          error: "Malformed pdf_url",
          pdf_url: rawUrl,
          normalizedPath: path,
        });
      }

      const folder = path.split("/").slice(0, -1).join("/");
      const file = path.split("/").slice(-1)[0];
      const { data: listed, error: listErr } = await s.storage
        .from(bucket)
        .list(folder || "", { search: file });
      if (listErr) {
        return json(500, {
          error: listErr.message,
          where: "storage.list",
          bucket,
          folder,
          file,
        });
      }

      const exists = Array.isArray(listed) && listed.some((x) => x.name === file);
      if (!exists) {
        return json(404, {
          error: "Report file not found in storage",
          pdf_url: rawUrl,
          where: "storage.list",
        });
      }

      const { data: signed, error: signErr } = await s.storage
        .from(bucket)
        .createSignedUrl(path, 3600);
      if (signErr) {
        return json(500, {
          error: signErr.message,
          where: "storage.sign",
          bucket,
          path,
        });
      }

      return NextResponse.redirect(signed.signedUrl, { status: 302 });
    };

    if (idParam) {
      const { data: byId, error: byIdErr } = await s
        .from("reports")
        .select("id, pdf_url, org_id, mission_id, title")
        .eq("id", idParam)
        .maybeSingle();

      if (byIdErr) {
        return json(500, { error: byIdErr.message, where: "select report by id" });
      }
      if (!byId) {
        return json(404, { error: "Report not found" });
      }
      if (!byId.pdf_url) {
        return json(404, { error: "Report not ready" });
      }

      return redirectForUrl(byId.pdf_url);
    }

    // 1) Load report row (be generous with selects for debugging)
    const q = s
      .from("reports")
      .select("id, org_id, mission_id, pdf_url, title")
      .limit(1);

    if (reportId) q.eq("id", reportId);
    if (missionId) q.eq("mission_id", missionId);
    if (orgId) q.eq("org_id", orgId);

    const { data: rows, error } = await q;
    if (error) return json(500, { error: error.message, where: "select report" });
    const r = rows?.[0];
    if (!r) return json(404, { error: "Report not found" });
    if (!r.pdf_url) return json(404, { error: "Report not ready" });

    return redirectForUrl(r.pdf_url);
  } catch (e) {
    return json(500, { error: String(e?.message || e), where: "catch" });
  }
}
