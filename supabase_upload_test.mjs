// supabase_upload_test.mjs
// Run: node supabase_upload_test.mjs

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// ====== EDIT THESE 5 LINES ======
const SUPABASE_URL  = 'https://dreorljakobbspcnkdmm.supabase.co'; // From Supabase → Settings → API
const SERVICE_ROLE  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZW9ybGpha29iYnNwY25rZG1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI1MjYzNiwiZXhwIjoyMDcyODI4NjM2fQ.V7bemSgf2N8DmPjsiQIMPCyqB9h6PiDx2zdYfYgsfZw';                // From Supabase → Settings → API (Service role secret!)
const BUCKET        = 'mission-media';                          // Must exist in Supabase Storage
const ORG_ID        = 'dreorljakobbspcnkdmm';   // Your org id UUID
const MISSION_ID    = 'debug-mission';                          // Any string or UUID is fine for this test
const FILE_PATH     = '/Users/okafafi/Desktop/1366646.jpg';            // Absolute path to a local image/video
const KIND          = 'photo';                                  // 'photo' or 'video'
// ================================

function guessContentType(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png')  return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif')  return 'image/gif';
  if (ext === '.mp4')  return 'video/mp4';
  if (ext === '.mov')  return 'video/quicktime';
  return 'application/octet-stream';
}
function safe(s) {
  return String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

async function main() {
  // Basic sanity
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE at the top of the script.');
    process.exit(1);
  }
  if (!fs.existsSync(FILE_PATH)) {
    console.error('❌ FILE_PATH not found:', FILE_PATH);
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Read file
  const bytes = fs.readFileSync(FILE_PATH);
  const size = bytes.byteLength;
  const filename = path.basename(FILE_PATH);
  const contentType = guessContentType(FILE_PATH);

  console.log('→ Uploading');
  console.log('  Bucket     :', BUCKET);
  console.log('  Org        :', ORG_ID);
  console.log('  Mission    :', MISSION_ID);
  console.log('  Kind       :', KIND);
  console.log('  File       :', FILE_PATH);
  console.log('  Size       :', size, 'bytes');
  console.log('  Type       :', contentType);

  // Build storage path
  const rnd = (globalThis.crypto?.randomUUID?.() || String(Date.now()));
  const storagePath =
    `${safe(ORG_ID)}/` +
    `${safe(MISSION_ID)}/` +
    `${KIND === 'video' ? 'videos' : 'photos'}/` +
    `${rnd}__${safe(filename)}`;

  // Upload
  const { data: up, error: upErr } = await supabase
    .storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType, upsert: false });

  if (upErr) {
    console.error('❌ Upload error:', upErr);
    console.error('   • Check bucket exists and name is exactly:', BUCKET);
    console.error('   • Service role key is correct (Supabase Settings → API).');
    process.exit(1);
  }

  // Public URL (official + fallback)
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const official = pub?.publicUrl || null;
  const fallback = `${SUPABASE_URL.replace(/\/+$/,'')}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  const url = official || fallback;

  console.log('\n✅ Uploaded successfully.');
  console.log('  Path       :', storagePath);
  console.log('  Public URL :', url);
  console.log('\nOpen this URL in an incognito window to verify it loads.\n');
}

main().catch((e) => {
  console.error('❌ Exception:', e?.message || e);
  process.exit(1);
});