export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

type Requires = {
  photo?: boolean;
  video?: boolean;
  comment?: boolean;
  timer?: boolean;
  rating?: boolean;   // ← NEW
};

type ChecklistItemInput = {
  text?: string;
  yesNo?: boolean;
  requires?: Requires;
  order_index?: number;
};

function s(x: any): string { return (x ?? '').toString().trim(); }

function normalize(raw: ChecklistItemInput[], missionId: string) {
  return (raw || [])
    .map((it, i) => {
      const text = s(it?.text);
      if (!text) return null;

      const r = it?.requires || {};
      const yn = it?.yesNo === true;

      // detect rating from either the requires.rating toggle or an explicit answerType
      const hasRating =
        r.rating === true ||
        (typeof (it as any).answerType === 'string' && (it as any).answerType.toLowerCase() === 'rating');

      // other media flags
      const hasVideo = r.video === true;
      const hasPhoto = r.photo === true;
      const hasTimer = r.timer === true;
      const hasAnyMedia = hasVideo || hasPhoto || hasTimer;

      // precedence: rating > yes_no > rich > text
      const answer_type: 'text' | 'yes_no' | 'rich' | 'rating' =
        hasRating ? 'rating'
        : yn ? 'yes_no'
        : hasAnyMedia ? 'rich'
        : 'text';

      return {
        mission_id: missionId,
        mission_id_uuid: missionId,
        order_index: Number.isFinite(it?.order_index as any) ? Number(it?.order_index) : i,
        text,
        yes_no: answer_type === 'yes_no',   // store true only for yes/no steps
        answer_type,
        // keep flags as-is for UI needs; DB constraint only checks answer_type
        requires_photo:   !!r.photo,
        requires_video:   !!r.video,
        requires_comment: !!r.comment,
        requires_timer:   !!r.timer,
        // NOTE: no separate requires_rating column in DB; answer_type='rating' is the source of truth
      };
    })
    .filter(Boolean) as Array<{
      mission_id: string;
      mission_id_uuid: string;
      order_index: number;
      text: string;
      yes_no: boolean;
      answer_type: 'text' | 'yes_no' | 'rich' | 'rating';
      requires_photo: boolean;
      requires_video: boolean;
      requires_comment: boolean;
      requires_timer: boolean;
    }>;
}

// PUT: save the entire checklist snapshot
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const missionId = String(params.id || '').trim();

  if (!missionId) {
    return NextResponse.json({ error: 'Missing mission id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Supabase service key/url missing (check env)' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const raw: ChecklistItemInput[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
        ? body.items
        : [];

    const rows = normalize(raw, missionId);

    // Replace existing snapshot (support both mission_id columns)
    await supabaseAdmin.from('mission_checklist_items').delete().eq('mission_id', missionId);
    await supabaseAdmin.from('mission_checklist_items').delete().eq('mission_id_uuid', missionId);

    if (!rows.length) {
      return NextResponse.json({ ok: true, count: 0 }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const insertRes = await supabaseAdmin.from('mission_checklist_items').insert(rows);
    if (insertRes.error) {
      return NextResponse.json(
        { error: insertRes.error.message || 'Failed to save checklist' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json({ ok: true, count: rows.length }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('[checklist PUT] fatal', e?.message || e);
    return NextResponse.json(
      { error: e?.message || 'Checklist save failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

// GET: return items in the shape the app expects
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const missionId = String(params.id || "").trim();

  try {
    const { data, error } = await supabaseAdmin
      .from("mission_checklist_items")
      .select("id, order_index, text, yes_no, answer_type, requires_photo, requires_video, requires_comment, requires_timer")
      .or(`mission_id.eq.${missionId},mission_id_uuid.eq.${missionId}`)
      .order("order_index", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const items = (data || []).map((r: any) => ({
      id: r.id,
      title: r.text || "",
      description: null,
      yesNo: !!r.yes_no,
      requiresPhoto: !!r.requires_photo,
      requiresVideo: !!r.requires_video,
      requiresComment: !!r.requires_comment,
      requiresTimer: !!r.requires_timer,
      // expose both answerType and derived requires.rating so the app can detect either
      answerType: r.answer_type,                                     // 'text'|'yes_no'|'rich'|'rating'
      requires: {
        photo: !!r.requires_photo,
        video: !!r.requires_video,
        comment: !!r.requires_comment,
        timer: !!r.requires_timer,
        rating: r.answer_type === 'rating',                         // ← NEW
      },
      order_index: r.order_index,
    }));

    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Checklist load failed" }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}