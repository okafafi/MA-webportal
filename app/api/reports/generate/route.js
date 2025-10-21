// app/api/reports/generate/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { buildMinimalPdf } from '../../../../lib/report_pdf';

const json = (s, o) =>
  new Response(JSON.stringify(o, null, 2), {
    status: s,
    headers: { "Content-Type": "application/json" },
  });

export async function POST(req) {
  const stage = { step: "start" };
  let reportId = null;

  try {
    const { reportId: payloadReportId } = await req.json().catch(() => ({}));
    reportId = payloadReportId ?? null;
    if (!reportId) return json(400, { error: "reportId required", stage });

    const s = supabaseAdmin;

    // 1) Load report row
    stage.step = "load-report";
    const { data: rep, error: repErr } = await s
      .from("mission_reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();

    if (repErr) return json(500, { error: repErr.message, stage });
    if (!rep) return json(404, { error: "Report not found", stage });

    reportId = rep.id;
    const missionId = rep.mission_id;
    const orgId = rep.org_id;

    await s
      .from("mission_reports")
      .update({ status: "Generating" })
      .eq("id", reportId);

    // 2) Load latest submission for that mission
    stage.step = "load-submission";
    const { data: sub, error: subErr } = await s
      .from("mission_submissions")
      .select("*")
      .eq("mission_id", missionId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) return json(500, { error: subErr.message, stage });
    if (!sub) return json(404, { error: "No submission found for mission", stage });

    // 3) Load items (answers) for the submission
    stage.step = "load-items";
    const { data: items, error: itemsErr } = await s
      .from("mission_submission_items")
      .select("*")
      .eq("submission_id", sub.id);

    if (itemsErr) return json(500, { error: itemsErr.message, stage });

    // 4) Load mission (title/address/etc)
    stage.step = "load-mission";
    const { data: mission, error: missionErr } = await s
      .from("missions")
      .select("id, org_id, title, store, location, starts_at, expires_at, status")
      .eq("id", missionId)
      .maybeSingle();

    if (missionErr) return json(500, { error: missionErr.message, stage });
    if (!mission) return json(404, { error: "Mission not found", stage });

   // 5) Map checklist item question text → used as printed title
    stage.step = "load-checklist-titles";
    const { data: titles, error: tErr } = await s
      .from("mission_checklist_items")
      .select("id, text")               // <- pull the real question text
      .eq("mission_id", missionId);

    if (tErr) return json(500, { error: tErr.message, stage });

    const textById = new Map((titles || []).map(r => [r.id, r.text || `Item ${r.id}`]));

    // IMPORTANT: set `title` so the PDF builder prints the question text
    const itemsWithTitles = (items || []).map(it => ({
      ...it,
      title: textById.get(it.checklist_item_id) || `Item ${it.checklist_item_id}`,
    }));

   // 6) Collect referenced attachment ids (for thumbnails/links)
   stage.step = "load-attachments";
   const attIds = [];
   for (const it of items || []) {
     if (it.photo_attachment_id) attIds.push(it.photo_attachment_id);
     if (it.order_photo_attachment_id) attIds.push(it.order_photo_attachment_id);
     if (it.video_attachment_id) attIds.push(it.video_attachment_id);
   }
   const uniqIds = Array.from(new Set(attIds));
   let attachments = [];
   if (uniqIds.length) {
     const { data: atts, error: attErr } = await s
       .from("mission_attachments")
       .select("id, path, content_type, size")
       .in("id", uniqIds);
     if (attErr) return json(500, { error: attErr.message, stage });

    const bucket = "mission-uploads";
    attachments = (atts || []).map((a) => {
      const isImage = (a.content_type || "").startsWith("image/");
      const storage = s.storage.from(bucket);
      const { data: pub } = isImage
        ? storage.getPublicUrl(a.path, { transform: { width: 800, format: "png" } })
        : storage.getPublicUrl(a.path);

      return {
        ...a,
        public_url: pub?.publicUrl || null,
      };
    });
  }

    // 7) Build PDF buffer (branded; thumbnails via public URLs)
    stage.step = "build-pdf";
    const pdfBytes = await buildMinimalPdf({
      missionId,
      orgId,
      submission: sub,
      mission,
      items: itemsWithTitles,
      attachments,
      // <-- critical so the builder can form public storage URLs
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    });
    const pdfBuffer = Buffer.from(pdfBytes);

    // 8) Upload to 'reports' bucket (public)
    stage.step = "upload";
    const objectKey = `${orgId}/${missionId}/${reportId}.pdf`;
    const up = await s.storage.from("reports").upload(objectKey, pdfBuffer, {
      upsert: true,
      contentType: "application/pdf",
    });
    if (up.error) return json(500, { error: up.error.message, stage });

    const pdfUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reports/${encodeURIComponent(
      objectKey
    )}`;

    // 9) Update mission_reports.pdf_url + title
    stage.step = "update-db";
    const { error: uErr } = await s
      .from("mission_reports")
      .update({ pdf_url: pdfUrl, title: mission?.title || "Mission Report", status: "Ready" })
      .eq("id", reportId);

    if (uErr) return json(500, { error: uErr.message, stage });

    return json(200, { ok: true, pdf_url: pdfUrl, stage });
  } catch (e) {
    if (reportId) {
      await supabaseAdmin
        .from("mission_reports")
        .update({ status: "Failed" })
        .eq("id", reportId);
    }
    return json(500, { error: String(e?.message || e), stage });
  }
}
