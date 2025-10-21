import { NextResponse } from 'next/server';
import { getServiceClient } from '../../../../lib/supa';

export const runtime = 'nodejs';
export const preferredRegion = ['sfo1', 'pdx1', 'cle1', 'cdg1', 'fra1'];

export async function GET() {
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supa = getServiceClient();
    const { data: missions, error } = await supa.from('missions').select('id, title').limit(1);
    return NextResponse.json({
      env: {
        hasUrl: !!url,
        hasServiceKey: !!key,
        source: url
          ? 'SUPABASE_URL'
          : process.env.NEXT_PUBLIC_SUPABASE_URL
          ? 'NEXT_PUBLIC_SUPABASE_URL'
          : null,
      },
      connectable: !error,
      resolved: {
        missions: { name: 'missions' },
        submissions: { name: 'mission_submissions' },
        checklist: { name: 'mission_checklist_items' },
      },
      sample: missions?.[0] || null,
      error: error?.message || null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
