// app/api/debug/route.js
import { supabaseService } from '../../../lib/supabase';

export async function GET() {
  try {
    const supabase = supabaseService();
    const { data, error } = await supabase
      .from('missions')   // table we already created
      .select('id')
      .limit(1);

    return new Response(JSON.stringify({ data, error }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}