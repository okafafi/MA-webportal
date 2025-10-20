import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const DISABLED = process.env.NODE_ENV === "production";
export const dynamic = "force-dynamic";

export async function POST(req) {
  if (DISABLED) {
    return NextResponse.json(
      { ok: false, error: "Disabled in production" },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId") || "";
  if (!orgId) return NextResponse.json({ error:"orgId required" }, { status:400 });

  const now = Date.now();
  const mk = (p) => ({
    org_id: orgId,
    title: p.title,
    store: p.store,
    status: p.status, // "Now"|"Scheduled"
    starts_at: new Date(p.startsAt).toISOString(),
    expires_at: new Date(p.expiresAt).toISOString(),
    location: p.location,
    checklist: p.checklist,
    requires_video: !!p.requiresVideo,
    requires_photos: !!p.requiresPhotos,
    time_on_site_min: p.timeOnSiteMin ?? 10,
    budget: p.budget ?? 0,
    fee: p.fee ?? 0
  });

  const rows = [
    mk({
      title:"Fast Food Mystery Visit",
      store:"Demo Store",
      status:"Now",
      startsAt: now,
      expiresAt: now + 7*24*3600*1000,
      location:{ lat:30.0444, lng:31.2357, address:"Tahrir, Cairo" },
      checklist:[
        { text:"Was the greeting friendly?", requires:{ comment:true } },
        { text:"Order accuracy verified",   requires:{ photo:true } },
        { text:"Yes/No example",            requires:{ yesno:true } },
      ],
      budget:120, fee:30
    }),
    mk({
      title:"Retail Store Audit",
      store:"Demo Retail",
      status:"Scheduled",
      startsAt: now + 24*3600*1000,
      expiresAt: now + 8*24*3600*1000,
      location:{ lat:30.0667, lng:31.2167, address:"Zamalek, Cairo" },
      checklist:[
        "Signage present at entrance",
        { text:"Shelves tidy", requires:{ photo:true } }
      ],
      budget:0, fee:50
    }),
    mk({
      title:"Bank Branch Service",
      store:"Demo Branch",
      status:"Scheduled",
      startsAt: now + 48*3600*1000,
      expiresAt: now + 9*24*3600*1000,
      location:{ lat:30.056, lng:31.330, address:"Nasr City, Cairo" },
      checklist:[
        { text:"Security present", requires:{} },
        { text:"Waiting time", requires:{ timer:true, comment:true } }
      ],
      budget:0, fee:60
    }),
  ];

  try {
    const { data, error } = await supabaseAdmin
      .from("missions")
      .insert(rows)
      .select();
    if (error) throw error;
    return NextResponse.json({ ok:true, inserted:(data||[]).length, ids:(data||[]).map(r=>r.id) });
  } catch (e) {
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:500 });
  }
}
