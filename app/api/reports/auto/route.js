export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServiceClient, toPublicUrl } from '../../../../lib/supa';
import { buildMinimalPdf, __fontDiag } from '../../../../lib/report_pdf';

// --- helpers: safe accessors ---
const val = (x, d = null) => (x === undefined || x === null ? d : x);
// Fetch all data we need from *your actual tables* without guessing names
async function fetchSubmissionBundle({ submissionId, missionId }) {
  const supa = getServiceClient();

  if (!submissionId) {
    throw new Error('submissionId is required.');
  }

  let submission = null;
  try {
    const { data, error } = await supa
      .from('mission_submissions')
      .select('*')
      .eq('id', submissionId)
      .maybeSingle();
    submission = error ? null : data;
  } catch {
    submission = null;
  }

  const { data: itemsRaw, error: itemsErr } = await supa
    .from('mission_submission_items')
    .select(
      'id, submission_id, checklist_item_id, yes_no, comment, timer_seconds, rating, rating_score, photo_attachment_id, order_photo_attachment_id, video_attachment_id'
    )
    .eq('submission_id', submissionId);
  if (itemsErr) throw new Error(`items: ${itemsErr.message}`);
  const items = itemsRaw || [];

  const checklistIds = [...new Set(items.map((i) => i.checklist_item_id).filter(Boolean))];
  let checklistMap = {};
  if (checklistIds.length) {
    const { data: checklistRows, error: chkErr } = await supa
      .from('mission_checklist_items')
      .select('id, title, answer_type')
      .in('id', checklistIds);
    if (chkErr) throw new Error(`checklist: ${chkErr.message}`);
    checklistMap = (checklistRows || []).reduce((m, r) => {
      m[r.id] = r;
      return m;
    }, {});
  }

  const { data: assetsRaw, error: assetsErr } = await supa
    .from('mission_submission_assets')
    .select('id, submission_id, kind, bucket, path, bytes, mime, created_at')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });
  if (assetsErr) throw new Error(`assets: ${assetsErr.message}`);
  const assets = assetsRaw || [];
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const { data: answersRaw, error: ansErr } = await supa
    .from('mission_answers')
    .select(
      'id, submission_id, item_id, value_yn, value_text, value_number, value_duration_ms, media_path, media_type, created_at'
    )
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });
  if (ansErr) throw new Error(`answers: ${ansErr.message}`);
  const answers = answersRaw || [];

  let mission = null;
  if (missionId) {
    try {
      const { data, error } = await supa
        .from('missions')
        .select('id, title, status, store, location')
        .eq('id', missionId)
        .maybeSingle();
      mission = error ? null : data;
    } catch {
      mission = null;
    }
  }

    // Build checklist from items (primary source)
    const checklistFromItems = items.map((i) => {
      const meta = checklistMap[i.checklist_item_id] || {};
      const media = [];

      const pushAsset = (assetId) => {
        if (!assetId) return;
        const a = assetById.get(assetId);
        if (a) {
          media.push({
            kind: a.kind,
            mime: a.mime,
            path: a.path,
            url: toPublicUrl(a.path),
          });
        }
      };
      pushAsset(i.photo_attachment_id);
      pushAsset(i.order_photo_attachment_id);
      pushAsset(i.video_attachment_id);

      // Fallback media from answers if no asset rows exist
      if (!media.length) {
        const ans = answers.find((a) => a.item_id === i.checklist_item_id && a.media_path);
        if (ans && ans.media_path) {
          media.push({
            kind: ans.media_type || 'unknown',
            mime: null,
            path: ans.media_path,
            url: toPublicUrl(ans.media_path),
          });
        }
      }

      return {
        id: i.checklist_item_id,
        title: val(meta.title, 'Untitled item'),
        answer_type: val(meta.answer_type, null),
        yes_no: val(i.yes_no, null),
        comment: val(i.comment, null),
        timer_seconds: val(i.timer_seconds, null),
        rating: val(i.rating, null),
        rating_score: val(i.rating_score, null),
        media,
      };
    });

    // Fallback: derive checklist rows from mission_answers for any item_ids
    // that aren't present in mission_submission_items
    const already = new Set(checklistFromItems.map((r) => r.id).filter(Boolean));
    const checklistFromAnswers = [];

    for (const a of answers) {
      const cid = a.item_id;
      if (!cid || already.has(cid)) continue;

      const meta = checklistMap[cid] || {};

      // Map answer values to normalized fields
      const yes_no = a.value_yn ?? null;
      const rating =
        a.value_number != null && !isNaN(Number(a.value_number))
          ? Number(a.value_number)
          : null;
      const comment = a.value_text ?? null;
      const timer_seconds =
        a.value_duration_ms != null ? Math.round(Number(a.value_duration_ms) / 1000) : null;

      const media = [];
      if (a.media_path) {
        media.push({
          kind: a.media_type || 'unknown',
          mime: null,
          path: a.media_path,
          url: toPublicUrl(a.media_path),
        });
      }

      checklistFromAnswers.push({
        id: cid,
        title: val(meta.title, 'Untitled item'),
        answer_type: val(meta.answer_type, null),
        yes_no,
        comment,
        timer_seconds,
        rating,
        rating_score: rating,
        media,
      });
    }

    const checklist = [...checklistFromItems, ...checklistFromAnswers];

  const photoUrlsRaw = [
    ...assets
      .filter((a) => a.kind === 'photo' && a.path)
      .map((a) => toPublicUrl(a.path))
      .filter(Boolean),
    ...answers
      .filter((a) => a.media_type === 'photo' && a.media_path)
      .map((a) => toPublicUrl(a.media_path))
      .filter(Boolean),
  ];
  const seen = new Set();
  const photoUrls = photoUrlsRaw.filter((u) => u && !seen.has(u) && seen.add(u));

  return {
    submission,
    mission,
    checklist,
    photoUrls,
    counts: {
      items: checklist.length,
      photos: photoUrls.length,
      answers: answers.length,
      assets: assets.length,
    },
  };
}

export async function POST(req) {
  const url = new URL(req.url);
  const diag = url.searchParams.get('diag');
  const dry = url.searchParams.get('dry') === '1';

  if (diag === 'font') {
    return NextResponse.json({ ok: true, fontDiag: __fontDiag });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const submissionId =
    body.submissionId || body.submission_id || body.submission || null;
  const missionId = body.missionId || body.mission_id || null;

  try {
    const bundle = await fetchSubmissionBundle({ submissionId, missionId });

    if (diag === 'fetch') {
      return NextResponse.json({
        ok: true,
        diag: 'fetch',
        inputs: { submissionId, missionId },
        counts: bundle.counts,
        sample: {
          mission: bundle.mission
            ? { id: bundle.mission.id, title: bundle.mission.title, status: bundle.mission.status }
            : null,
          firstChecklist: bundle.checklist[0] || null,
          firstPhoto: bundle.photoUrls[0] || null,
        },
      });
    }

    if (dry) {
      return NextResponse.json({
        ok: true,
        dry: true,
        payload: {
          title: bundle.mission?.title ? `Mission Report — ${bundle.mission.title}` : 'Mission Report',
          mission: bundle.mission
            ? {
                id: bundle.mission.id,
                title: bundle.mission.title || null,
                status: bundle.mission.status || null,
                store: val(bundle.mission.store, null),
                address: val(bundle.mission?.location?.address, null),
              }
            : null,
          checklist: bundle.checklist,
          photoUrls: bundle.photoUrls,
        },
      });
    }

    const supa = getServiceClient();

    const payload = {
      title: bundle.mission?.title ? `Mission Report — ${bundle.mission.title}` : 'Mission Report',
      missionId: missionId || bundle.mission?.id || null,
      orgId: bundle.submission?.org_id || null,
      submission: {
        submitted_at: bundle.submission?.submitted_at || null,
        comment: bundle.submission?.comment || null,
      },
      mission: bundle.mission
        ? {
            id: bundle.mission.id,
            title: bundle.mission.title || null,
            store: val(bundle.mission.store, null),
            location: { address: val(bundle.mission?.location?.address, null) },
            status: val(bundle.mission.status, null),
            starts_at: val(bundle.mission.starts_at, null),
            expires_at: val(bundle.mission.expires_at, null),
          }
        : null,
      checklist: bundle.checklist.map((row) => ({
        title: row.title,
        rating: row.rating ?? row.rating_score ?? null,
        yes_no: row.yes_no,
        comment: row.comment,
      })),
      photoUrls: bundle.photoUrls,
      supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    };

    const pdfBytes = await buildMinimalPdf(payload);
    const pdfBuffer = Buffer.from(pdfBytes);
    const objectPath = `${payload.orgId || 'unknown'}/${payload.missionId || 'unknown'}/auto_${Date.now()}.pdf`;

    const { error: uploadErr } = await supa.storage
      .from('mission-uploads')
      .upload(objectPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    if (uploadErr) {
      throw new Error(`upload: ${uploadErr.message}`);
    }

    const pdfUrl = toPublicUrl(objectPath);

    return NextResponse.json({
      ok: true,
      pdf_url: pdfUrl,
      counts: bundle.counts,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        diag: diag || undefined,
        error: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
