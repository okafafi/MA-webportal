// app/api/debug/photos/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

function pubUrl(storage, path) {
  if (!path) return null;
  const { data: pub } = storage.from('mission-uploads').getPublicUrl(path);
  return pub?.publicUrl || null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const submissionId = (searchParams.get('submissionId') || '').trim();
    if (!submissionId) return NextResponse.json({ error: 'submissionId is required' }, { status: 400 });

    const s = supabaseAdmin;
    const photosByItem = new Map();
    const gallerySet = new Set();

    // 1) mission_answers
    const { data: ans, error: ansErr } = await s
      .from('mission_answers')
      .select('item_id, media_type, media_path')
      .eq('submission_id', submissionId)
      .not('media_path', 'is', null);
    if (ansErr) throw ansErr;

    for (const r of ans || []) {
      const t = String(r.media_type || '').toLowerCase();
      if (!(t === 'photo' || t.startsWith('image'))) continue;
      const url = pubUrl(s.storage, r.media_path);
      if (!url) continue;
      const arr = photosByItem.get(r.item_id) || [];
      arr.push(url);
      photosByItem.set(r.item_id, arr);
      gallerySet.add(url);
    }

    // 2) legacy: mission_submission_items → mission_attachments
    const { data: items, error: itemsErr } = await s
      .from('mission_submission_items')
      .select('checklist_item_id, photo_attachment_id, order_photo_attachment_id')
      .eq('submission_id', submissionId);
    if (itemsErr) throw itemsErr;

    for (const r of items || []) {
      const ids = [r.photo_attachment_id, r.order_photo_attachment_id].filter(Boolean);
      for (const attId of ids) {
        const { data: atts } = await s
          .from('mission_attachments')
          .select('path, content_type')
          .eq('id', attId)
          .limit(1);
        const att = (atts && atts[0]) || null;
        if (!att) continue;
        const type = String(att.content_type || '').toLowerCase();
        if (!(type === 'photo' || type.startsWith('image'))) continue;
        const url = pubUrl(s.storage, att.path);
        if (!url) continue;
        const arr = photosByItem.get(r.checklist_item_id) || [];
        arr.push(url);
        photosByItem.set(r.checklist_item_id, arr);
        gallerySet.add(url);
      }
    }

    const itemPhotoCounts = {};
    for (const [k, v] of photosByItem.entries()) itemPhotoCounts[k] = v.length;

    const itemsOut = Array.from(photosByItem.entries()).map(([item_id, urls]) => ({ item_id, urls }));
    return NextResponse.json({
      ok: true,
      submissionId,
      itemPhotoCounts,
      gallery: Array.from(gallerySet).slice(0, 6),
      items: itemsOut
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
