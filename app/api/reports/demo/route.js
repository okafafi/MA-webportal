// app/api/reports/demo/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildPdf } from "../../../../lib/report_pdf";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function GET() {
  try {
    const missionId = "demo-mission";
    const orgId = "demo-org";

    const mission = {
      id: missionId,
      title: "Demo Mission",
      store: "Test Store",
      location: { address: "" },
      status: "Completed",
    };

    const submission = {
      submitted_at: new Date().toISOString(),
      agent_id: "demo-agent",
      comment: "Demo submission",
    };

    // Minimal sample items, including a rating to verify it prints
    const items = [
      {
        checklist_item_id: "i1",
        title: "Was the store clean?",
        yes_no: true,
        comment: "All good.",
        timer_seconds: null,
        photo_attachment_id: null,
        order_photo_attachment_id: null,
        video_attachment_id: null,
      },
      {
        checklist_item_id: "i2",
        title: "Rate overall cleanliness",
        rating: 4, // should render as “Rating: 4/5” if your builder includes the rating label
      },
    ];

    const attachments = [];

    const pdfBuffer = await buildPdf({
      missionId,
      orgId,
      submission,
      mission,
      items,
      attachments,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="demo.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
