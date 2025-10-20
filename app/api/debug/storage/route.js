// app/api/debug/storage/route.js
import { supabaseService } from "../../../../lib/supabase";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) {
      return json(500, {
        error: "Missing env",
        NEXT_PUBLIC_SUPABASE_URL: !!url,
        SUPABASE_SERVICE_ROLE_KEY: service
      });
    }

    const s = supabaseService();

    // 1) list buckets (proves Storage connectivity)
    const { data: buckets, error: bucketsErr } = await s.storage.listBuckets();

    // 2) ensure mission-media exists
    const hasMissionMedia = (buckets || []).some(b => b.name === "mission-media");

    // 3) write a small text file to mission-media/test/hello.txt
    let uploadResult = null;
    let publicUrl = null;
    let uploadErr = null;
    if (hasMissionMedia) {
      const path = `test/hello_${Date.now()}.txt`;
      const content = new TextEncoder().encode("hello from debug route\n");
      const { data, error } = await s.storage
        .from("mission-media")
        .upload(path, content, { contentType: "text/plain", upsert: false });
      uploadResult = data;
      uploadErr = error || null;

      // get public URL for the uploaded file
      const { data: pub } = s.storage.from("mission-media").getPublicUrl(path);
      publicUrl = pub?.publicUrl || null;
    }

    // 4) list objects under mission-media root (first 50)
    let listObjects = null;
    if (hasMissionMedia) {
      const { data: objs, error: listErr } = await s.storage
        .from("mission-media")
        .list("", { limit: 50, offset: 0 });
      listObjects = { objs, listErr };
    }

    return json(200, {
      ok: true,
      env: { NEXT_PUBLIC_SUPABASE_URL: url, hasServiceKey: service },
      buckets: { buckets, bucketsErr },
      hasMissionMedia,
      uploadResult,
      uploadErr,
      publicUrl,
      listObjects
    });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}