// app/api/app/upload/route.js
import { supabaseService } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (s, o) => new Response(JSON.stringify(o, null, 2), { status: s, headers:{'Content-Type':'application/json'} });
const safe = s => String(s||'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);

export async function GET() {
  return json(200, {
    ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
}

export async function POST(req) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error:'Missing Supabase env' });
    }
    const form = await req.formData();

    const file = form.get('file');
    const orgId = form.get('orgId');
    const missionId = form.get('missionId');
    const kind = form.get('kind') || 'photo';
    const filename = form.get('filename') || (file?.name || 'upload.bin');

    // Basic presence checks
    if (!file) return json(400, { error:'file is required', got: Array.from(form.keys()) });
    if (!orgId) return json(400, { error:'orgId is required' });
    if (!missionId) return json(400, { error:'missionId is required' });

    // Read bytes
    const type = file.type || 'application/octet-stream';
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);
    const size = bytes.byteLength;

    // Early return if size is 0 (tells us curl/form was wrong)
    if (size === 0) {
      return json(400, {
        error: 'Empty file payload',
        diagnostics: { filename, type, size, note: 'Your client likely did not send binary data.' }
      });
    }

    // Only images/videos (you can relax this if you want)
    if (!/^image\/|^video\//.test(type)) {
      return json(400, { error: 'Only image/* or video/* allowed', filename, type, size });
    }

    const rnd = (globalThis.crypto?.randomUUID?.() || Date.now().toString());
    const path = `${safe(orgId)}/${safe(missionId)}/${kind==='video'?'videos':'photos'}/${rnd}__${safe(filename)}`;

    const s = supabaseService();
    const { data: up, error: upErr } = await s.storage.from('mission-media').upload(path, bytes, { contentType: type, upsert:false });

    const { data: pub } = s.storage.from('mission-media').getPublicUrl(path);
    const url = pub?.publicUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/,'')}/storage/v1/object/public/mission-media/${path}`;

    return json(upErr ? 500 : 200, {
      ok: !upErr,
      filename, type, size,
      path, uploadData: up, uploadError: upErr || null,
      url
    });
  } catch (e) {
    return json(500, { error:'Exception', message: String(e?.message||e) });
  }
}