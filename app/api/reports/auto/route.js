export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = ["sfo1","pdx1","cle1","cdg1","fra1"];

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { createPdfDoc, __pdfPatchInfo } from "../../../../lib/report_pdf.js";

const json=(s,o)=>new Response(JSON.stringify(o,null,2),{
  status:s,
  headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
});
const fmt = (dt)=> { try{ return new Date(dt).toLocaleString(); } catch { return String(dt); } };

const safeNum = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

async function fetchImageBuffer(url) {
  try {
    const clean = typeof url === "string" ? url.trim() : "";
    if (!clean) return null;
    const res = await fetch(encodeURI(clean), { redirect: "follow" });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function drawPhotosRow(doc, urls, { width = 120, gap = 10 } = {}) {
  if (!Array.isArray(urls) || urls.length === 0) return 0;
  let x = doc.page.margins.left;
  const y = doc.y;
  let drawn = 0;
  for (const u of urls) {
    const buf = await fetchImageBuffer(u);
    if (buf) {
      doc.image(buf, x, y, { fit: [width, width * 0.75] });
      drawn++;
    } else {
      doc.rect(x, y, width, width * 0.75).stroke();
    }
    x += width + gap;
  }
  doc.x = doc.page.margins.left;
  doc.moveDown(0.8);
  return drawn;
}

async function renderReportDocument(doc, payload) {
  const {
    title = "Mission Report",
    mission = {},
    submission = {},
    photoUrls = [],
    checklist = [],
  } = payload || {};

  return await new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    (async () => {
      const ratings = (checklist || [])
        .map((item) => safeNum(item.rating ?? item.rating_score ?? item.rating_value, NaN))
        .filter(Number.isFinite);
      const overall = ratings.length
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
        : null;

      doc.font("Inter-Bold").fontSize(18).fillColor("black").text(title);
      doc.font("Inter-Regular").fontSize(10).fillColor("#555");
      doc.text(`Mission: ${mission.title || mission.id || "—"}`);
      if (mission.store) doc.text(`Store: ${mission.store}`);
      if (mission.location?.address) doc.text(`Address: ${mission.location.address}`);
      doc.text(`Submitted: ${submission.submitted_at ? fmt(submission.submitted_at) : "—"}`);
      if (overall) {
        doc.moveDown(0.3);
        doc.font("Inter-Bold").fontSize(12).fillColor("#111").text(`Overall Rating: ${overall}/5`);
      }
      doc.font("Inter-Regular").fillColor("black").moveDown(0.8);

      if (Array.isArray(photoUrls) && photoUrls.length) {
        doc.font("Inter-Bold").fontSize(12).text("Photos", { underline: true });
        doc.moveDown(0.4);
        await drawPhotosRow(doc, photoUrls.slice(0, 3));
        if (photoUrls.length > 3) {
          await drawPhotosRow(doc, photoUrls.slice(3, 6));
        }
      }

      doc.moveDown(0.4);
      doc.font("Inter-Bold").fontSize(14).text("Checklist", { underline: true });
      doc.moveDown(0.4);

      if (!Array.isArray(checklist) || checklist.length === 0) {
        doc.font("Inter-Regular").fontSize(11).fillColor("#555").text("No checklist items.");
        doc.fillColor("black");
      } else {
        for (const item of checklist) {
          const itemTitle = item.title || item.displayTitle || item.text || "Checklist item";
          doc.font("Inter-Bold").fontSize(12).fillColor("black").text(itemTitle);
          doc.font("Inter-Regular").fontSize(10).fillColor("#444");

          const yn = item.yes_no ?? item.value_yn;
          if (yn != null) doc.text(`Yes/No: ${yn ? "Yes" : "No"}`);

          const rating = item.rating ?? item.rating_score ?? item.rating_value;
          if (rating != null) doc.text(`Rating: ${rating}/5`);

          const timer = item.timer_seconds ?? item.timerSeconds;
          if (timer != null) doc.text(`Timer: ${timer}s`);

          if (item.comment) {
            doc.text(`Comment: ${String(item.comment)}`);
          }
          doc.fillColor("black");

          if (Array.isArray(item.photoUrls) && item.photoUrls.length) {
            await drawPhotosRow(doc, item.photoUrls.slice(0, 3));
          }

          doc.moveDown(0.5);
        }
      }

      doc.end();
    })().catch(reject);
  });
}

async function collectSubmissionPhotos({ supabaseAdmin, submissionId }) {
  const { data, error } = await supabaseAdmin
    .from('mission_answers')
    .select('item_id, media_type, media_path')
    .eq('submission_id', submissionId)
    .not('media_path', 'is', null);

  if (error) throw error;

  const photosByItem = new Map();
  const gallery = [];

  for (const row of data || []) {
    const type = String(row.media_type || '').toLowerCase();
    if (!(type === 'photo' || type.startsWith('image'))) continue;

    const mediaPath = (row.media_path || '').trim();
    if (!mediaPath) continue;

    const { data: pub } = supabaseAdmin
      .storage.from('mission-uploads')
      .getPublicUrl(mediaPath);
    const url = pub?.publicUrl;
    if (!url || !url.startsWith('https://')) continue;

    const arr = photosByItem.get(row.item_id) || [];
    arr.push(url);
    photosByItem.set(row.item_id, arr);
    gallery.push(url);
  }

  const galleryUrls = Array.from(new Set(gallery)).slice(0, 6);
  return { photosByItem, galleryUrls };
}

// Simple KPIs from yes/no items
function kpisFromChecklist(ans=[]) {
  const yesNo = ans.filter(a=>a.yesNo);
  const total = yesNo.length || 1;
  const yesCount = yesNo.filter(a=>!!a.yesNoValue).length;
  const overall = Math.round((yesCount/total)*100);
  const service = Math.max(70, Math.min(98, overall - 2));
  const compliance = Math.max(75, Math.min(99, overall + 3));
  const speed = Math.max(70, Math.min(97, overall - 6));
  return { overall, service, compliance, speed };
}

function normalizeAnswersForPdf(answers = []) {
  const rows = [];
  const attachments = [];

  (answers || []).forEach((a, idx) => {
    if (!a) return;
    const id =
      a.checklist_item_id ||
      a.id ||
      a.itemId ||
      (typeof a.itemIndex !== "undefined" ? `auto-${a.itemIndex}` : `auto-${idx}`);
    const title = a.text || a.title || `Item ${idx + 1}`;
    const yesNo =
      typeof a.yesNoValue === "boolean"
        ? a.yesNoValue
        : typeof a.yesNo === "boolean"
          ? a.yesNo
          : null;
    const comment =
      typeof a.comment === "string" && a.comment.trim().length
        ? a.comment.trim()
        : null;
    const timer =
      Number.isFinite(a.timerSec)
        ? Number(a.timerSec)
        : Number.isFinite(a.timer_seconds)
          ? Number(a.timer_seconds)
          : null;
    const ratingRaw = Number.isFinite(a.rating)
      ? Number(a.rating)
      : Number.isFinite(a.rating_value)
        ? Number(a.rating_value)
        : null;
    const rating =
      ratingRaw != null ? Math.min(5, Math.max(1, Math.round(ratingRaw))) : null;

    const row = {
      checklist_item_id: id,
      title,
      yes_no: typeof yesNo === "boolean" ? yesNo : null,
      comment,
      timer_seconds: timer,
      rating,
      rating_value: rating,
    };

    const photos = Array.isArray(a.photos)
      ? a.photos
      : Array.isArray(a.photoUrls)
        ? a.photoUrls
        : [];
    if (photos.length) {
      const attId = `auto-photo-${idx}-0`;
      row.photo_attachment_id = attId;
      attachments.push({
        id: attId,
        public_url: String(photos[0]),
        content_type: "image/jpeg",
        size: null,
        path: null,
      });
    }

    const videos = Array.isArray(a.videos)
      ? a.videos
      : Array.isArray(a.videoUrls)
        ? a.videoUrls
        : [];
    if (videos.length) {
      const attId = `auto-video-${idx}-0`;
      row.video_attachment_id = attId;
      attachments.push({
        id: attId,
        public_url: String(videos[0]),
        content_type: "video/mp4",
        size: null,
        path: null,
      });
    }

    rows.push(row);
  });

  return { rows, attachments };
}

export async function POST(req){
  const stage = {
    step: "start",
    photoUrls: [],
    photosRequested: 0,
    itemPhotoCounts: {},
    photosCount: 0,
  };
  let reportId = null;
  let baseMeta = null;
  let pdfUrl = null;
  let answersCount = 0;
  let itemsCount = 0;
  let hasChecklist = false;
  try{
    const s = supabaseAdmin;
    const url = new URL(req.url);
    const diag = url.searchParams.get("diag") === "1";

    if (diag) {
      const pkg = require("pdfkit/package.json");
      return new Response(JSON.stringify({
        ok: true,
        diag: true,
        pdfkitVersion: pkg.version,
        patchInfo: __pdfPatchInfo,
        initDefaultFontPatched: true
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      });
    }

    const body = await req.json().catch(()=>({}));
    stage.step = "validate";
    const orgId = body.orgId || body.org_id || null;
    const missionId = body.missionId || body.mission_id || null;
    const agentId = body.agentId || body.agent_id || null;
    let submissionId = String(body.submissionId || body.submission_id || '').trim();
    stage.submission_id = submissionId || null;
    stage.resolveSource = "body";

    const missing = [];
    if (!orgId) missing.push("orgId");
    if (!missionId) missing.push("missionId");
    if (!agentId) missing.push("agentId");
    if (missing.length) {
      return new Response(
        JSON.stringify({ ok: false, error: `Missing required fields: ${missing.join(", ")}`, stage }, null, 2),
        { status: 400, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      );
    }

    if (!submissionId) {
      return new Response(
        JSON.stringify({ ok: false, error: "submissionId required", stage }, null, 2),
        { status: 400, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      );
    }

    stage.step = "resolve-submission";
    const resolveSource = "body";
    stage.resolveSource = resolveSource;

    const wantedCols = [
      "id",
      "org_id",
      "mission_id",
      "agent_id",
      "status",
      "started_at",
      "submitted_at",
      "meta_json",
      "comment",
      "timer_ms",
    ].join(", ");

    stage.step = "fetch-submission";

    const { data: sub, error: subErr } = await s
      .from("mission_submissions")
      .select(wantedCols)
      .eq("id", submissionId)
      .single();
    if (subErr || !sub) return json(404,{ ok: false, error:"submission not found", stage });

    if (!sub?.submitted_at) {
      stage.nullSubmittedAt = true;
    }
    stage.submission = sub;
    submissionId = sub?.id ?? submissionId;
    stage.submission_id = sub?.id ?? null;
    stage.submitted_at = sub?.submitted_at ?? null;
    stage.resolveSource = resolveSource;

    const submissionPayload = sub?.meta_json ?? {};

    // Mission
    stage.step = "fetch-mission";
    const { data: mission, error: eMiss } = await s.from("missions").select("*").eq("id", sub.mission_id).single();
    if (eMiss || !mission) return json(404,{ ok: false, error:"mission not found", stage });

    stage.step = "prepare-pdf";
    const store = mission.store || "";
    const reportTitle = `Mission Report — ${store || mission.title || mission.id}`;
    const win = `${fmt(mission.starts_at)} -> ${fmt(mission.expires_at)}`;
    const submittedAt = fmt(sub.submitted_at);
    const address = mission.address || mission.location?.address || "";

    // Answers + KPIs
    const answers = submissionPayload?.checklist || [];
    const kpis = kpisFromChecklist(answers);
    stage.kpis = kpis;
    const overall10 =
      typeof sub?.meta_json?.overall_rating_10 === "number"
        ? Number(sub.meta_json.overall_rating_10)
        : null;
    stage.overall10 = overall10;

    stage.step = "fetch-checklist-answers";
    const answersRes = await s
      .from("mission_answers")
      .select(
        `
        id,
        submission_id,
        item_id,
        value_yn,
        value_text,
        value_number,
        value_duration_ms,
        media_path,
        media_type,
        created_at
      `
      )
      .eq("submission_id", sub.id)
      .order("created_at", { ascending: true });
    if (answersRes.error) {
      stage.step = "fetch-checklist-answers";
      throw Object.assign(
        new Error("answers fetch failed"),
        { details: answersRes.error }
      );
    }
    const rawAnswers = answersRes.data ?? [];
    const normAnswers = rawAnswers.map((row) => ({
      ...row,
      item_id: row.item_id ?? null,
      yes_no: row.value_yn ?? null,
      comment: row.value_text ?? null,
      rating:
        row.value_number != null ? Number(row.value_number) : null,
      timer_seconds:
        row.value_duration_ms != null
          ? Math.round(row.value_duration_ms / 1000)
          : null,
      media_path: row.media_path ?? null,
      media_type: row.media_type ?? null,
    }));

    stage.step = "fetch-checklist-defs";
    const { data: defRows, error: defErr } = await s
      .from("mission_checklist_items")
      .select(
        `
        id,
        order_index,
        title,
        description,
        answer_type,
        yes_no,
        requires_photo,
        requires_video,
        requires_comment,
        requires_timer,
        requires_rating,
        text
      `
      )
      .eq("mission_id", sub.mission_id)
      .order("order_index", { ascending: true });
    if (defErr) {
      stage.step = "fetch-checklist-defs";
      throw Object.assign(
        new Error("checklist defs fetch failed"),
        { details: defErr }
      );
    }

    const defs = (defRows ?? []).map((def, idx) => {
      const raw =
        (def.text ?? def.title ?? "")?.toString().trim() || "";
      return {
        id: def.id,
        displayTitle: raw.length ? raw : "(untitled)",
        description:
          typeof def.description === "string" ? def.description : null,
        answer_type: def.answer_type ?? null,
        yes_no: def.yes_no ?? null,
        requires_photo: !!def.requires_photo,
        requires_video: !!def.requires_video,
        requires_comment: !!def.requires_comment,
        requires_timer: !!def.requires_timer,
        requires_rating: !!def.requires_rating,
        order_index: def.order_index ?? idx,
      };
    });

    const answersByItem = new Map(normAnswers.map((ans) => [ans.item_id, ans]));

    const items = Array.isArray(defs) ? defs : [];
    stage.step = "collect-photos";
    const { photosByItem, galleryUrls = [] } = await collectSubmissionPhotos({ supabaseAdmin, submissionId: sub.id });
    stage.photoUrls = galleryUrls;
    stage.photosRequested = galleryUrls.length;

    stage.itemPhotoCounts = {};
    const itemsWithPhotos = items.map((def) => {
      const ans = answersByItem.get(def.id) || {};
      const per = photosByItem.get(def.id) || photosByItem.get(def.checklist_item_id) || [];
      stage.itemPhotoCounts[def.id] = per.length;
      return {
        id: def.id,
        title: def.displayTitle,
        displayTitle: def.displayTitle,
        answer_type: def.answer_type,
        yes_no: ans.yes_no ?? null,
        rating: ans.rating ?? null,
        comment: ans.comment ?? null,
        timer_seconds: ans.timer_seconds ?? null,
        media_path: ans.media_path ?? null,
        media_type: ans.media_type ?? null,
        photoUrls: per.slice(0, 3),
      };
    });

    stage.step = "thread-items";
    const itemPhotoCounts = stage.itemPhotoCounts;
    const threadedCount = Object.values(itemPhotoCounts).reduce((sum, count) => sum + (count || 0), 0);
    stage.photosCount = threadedCount || stage.photoUrls.length;

    answersCount = normAnswers.length;
    itemsCount = defs.length;
    hasChecklist = itemsCount > 0;

    stage.hasChecklist = hasChecklist;
    stage.answersCount = answersCount;
    stage.itemsCount = itemsCount;
    stage.photosLoaded = 0;
    stage.checklistPreview = itemsWithPhotos.slice(0, 3).map((item) => ({
      title: item.displayTitle,
      rating: item.rating,
      yes_no: item.yes_no,
      comment: item.comment,
      timer_seconds: item.timer_seconds,
      media_path: item.media_path,
    }));

    if (process.env.NODE_ENV !== "production") {
      console.log("[auto:photos]", {
        submissionId,
        total: Object.values(itemPhotoCounts).reduce((a, b) => a + b, 0),
        items: photosByItem.size,
        gallery: stage.photoUrls.length,
      });
      const withPhotos = itemsWithPhotos.filter(
        (item) => Array.isArray(item.photoUrls) && item.photoUrls.length
      ).length;
      console.log("[auto:threading]", {
        checklistItems: itemsWithPhotos.length,
        itemsWithPhotos: withPhotos,
        photosRequested: stage.photosRequested,
        photosCount: stage.photosCount,
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[reports/auto] photos", {
        submissionId,
        gallery: stage.photoUrls.length,
        perItem: stage.itemPhotoCounts,
        photosCount: stage.photosCount,
      });
    }

    stage.step = "prepare-pdf";
    const { rows: pdfItems, attachments } = normalizeAnswersForPdf(answers);
    const submissionForPdf = {
      submitted_at: sub.submitted_at || null,
      comment: [
        submissionPayload?.comment ?? sub.comment,
        "Automated summary based on the received checklist.",
        "Top actions derived from missed checks and low sub-scores.",
      ]
        .filter(Boolean)
        .join("\n\n") || null,
    };

    baseMeta = {
      agent_id: agentId ?? null,
      submission_id: sub.id ?? null,
      mission_title: mission.title || null,
      store,
      address,
      window_text: win,
      submitted_at: sub.submitted_at,
      overall_rating_10: overall10,
    };
    stage.meta = baseMeta;

    const urlParams = new URL(req.url);
    const isDry = urlParams.searchParams.get("dry") === "1";

    const pdfPayload = {
      title: reportTitle,
      missionId: mission.id,
      orgId,
      submission: submissionForPdf,
      mission: {
        id: mission.id,
        title: mission.title,
        store,
        location: { address: mission.address || mission.location?.address || address || "" },
        status: mission.status,
        starts_at: mission.starts_at,
        expires_at: mission.expires_at,
      },
      items: pdfItems,
      attachments,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      kpis,
      overall10,
      checklist: itemsWithPhotos,
      photoUrls: galleryUrls,
    };

    if (isDry) {
      stage.step = "dry-run";
      return new Response(
        JSON.stringify({ ok: true, dry: true, stage, payload: pdfPayload }, null, 2),
        { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      );
    }

    if (urlParams.searchParams.get("preview") === "1") {
      stage.step = "preview";
      return new Response(
        JSON.stringify({ ok: true, preview: true, stage, submission: sub, items: itemsWithPhotos, photos: galleryUrls }, null, 2),
        { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      );
    }

    stage.step = "upsert-report-generating";
    const type = "mission";
    const nowIso = new Date().toISOString();
    const baseKey = {
      org_id: orgId,
      mission_id: mission.id,
      type,
    };
    let reportRowId = null;
    try {
      const { data: existing, error: existingErr } = await s
        .from("reports")
        .select("id")
        .eq("org_id", orgId)
        .eq("mission_id", mission.id)
        .eq("type", type)
        .maybeSingle();

      if (existingErr) {
        return json(500, {
          ok: false,
          error: existingErr.message || "reports lookup failed",
          stage,
        });
      }

      if (existing?.id) {
        reportRowId = existing.id;
        const { error: updateErr } = await s
          .from("reports")
          .update({
            status: "Generating",
            generated_at: nowIso,
            title: reportTitle,
            kpis: kpis || null,
            meta: baseMeta,
          })
          .eq("id", reportRowId);

        if (updateErr) {
          return json(500, {
            ok: false,
            error: updateErr.message || "reports update failed",
            stage,
          });
        }
      } else {
        const { data: insertData, error: insertErr } = await s
          .from("reports")
          .insert([
            {
              ...baseKey,
              status: "Generating",
              generated_at: nowIso,
              title: reportTitle,
              pdf_url: null,
              kpis: kpis || null,
              meta: baseMeta,
            },
          ])
          .select("id")
          .single();

        if (insertErr) {
          return json(500, {
            ok: false,
            error: insertErr.message || "reports insert failed",
            stage,
          });
        }
        reportRowId = insertData?.id ?? null;
      }
    } catch (err) {
      return json(500, {
        ok: false,
        error: String(err?.message || err),
        stage,
      });
    }

    reportId = reportRowId;
    stage.report_id = reportId;

    stage.step = "build-pdf";
    const doc = createPdfDoc();
    const pdfBuffer = await renderReportDocument(doc, pdfPayload);

    // Upload
    stage.step = "upload";
    const objectName = `org_${orgId}/mission_${mission.id}/auto_${Date.now()}.pdf`;
    const { error: upErr } = await s.storage.from("reports").upload(objectName, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      if (reportId) {
        await s.from("reports").update({ status: "Failed" }).eq("id", reportId);
      }
      return json(500, { ok: false, error: "upload failed", details: upErr, stage });
    }

    const { data: pub } = s.storage.from("reports").getPublicUrl(objectName);
    pdfUrl = pub?.publicUrl || null;

    stage.step = "upsert-report-ready";
    const readyPatch = {
      status: "Ready",
      pdf_url: pdfUrl,
      generated_at: new Date().toISOString(),
      title: reportTitle,
      meta: baseMeta,
      kpis: kpis || null,
    };
      const { data: readyRow, error: updateReadyErr } = await s
        .from("reports")
        .update(readyPatch)
        .eq("org_id", orgId)
        .eq("mission_id", mission.id)
        .eq("type", type)
        .select("id")
        .single();
    if (updateReadyErr) {
      await s
        .from("reports")
        .update({
          status: "Failed",
          meta: {
            ...(baseMeta || {}),
            error:
              updateReadyErr.message || "Failed to finalize report update",
          },
        })
        .eq("org_id", orgId)
        .eq("mission_id", mission.id)
        .eq("type", "mission");
      return json(500, {
        ok: false,
        error: "reports update (ready) failed",
        details: updateReadyErr,
        stage,
      });
    }
    reportId = readyRow?.id ?? reportId;
    stage.report_id = reportId;

    stage.step = "done";
    const successPayload = {
      ok: true,
      pdf_url: pdfUrl,
      report_id: reportId,
      answersCount,
      itemsCount,
      photosCount: stage.photosCount,
      photosRequested: stage.photosRequested,
      hasChecklist,
      resolveSource,
      stage,
    };
    return new Response(JSON.stringify(successPayload, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    try {
      const message = String(e?.message || e);
      if (stage?.report_id) {
        await supabaseAdmin
          .from("reports")
          .update({
            status: "Failed",
            meta: { ...(baseMeta || {}), error: message },
          })
          .eq("id", stage.report_id);
      }
    } catch {
      // ignore secondary failure
    }
    stage.step = "error";
    stage.error = String(e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: stage.error, stage }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
