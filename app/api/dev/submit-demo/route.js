// app/api/dev/submit-demo/route.js
import { supabaseService } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (s, o) => new Response(JSON.stringify(o, null, 2), {
  status: s, headers: { "Content-Type": "application/json" }
});

export async function GET() {
  try {
    const s = supabaseService();

    // 1) Ensure a demo org exists (create if none)
    let orgId = null;
    {
      const { data: orgs, error } = await s
        .from("orgs")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) return json(500, { error: "orgs select failed", details: error });

      if (!orgs?.length) {
        const { data, error: insErr } = await s
          .from("orgs")
          .insert({ name: "Investor Demo Org" })
          .select("id")
          .single();
        if (insErr) return json(500, { error: "org insert failed", details: insErr });
        orgId = data.id;
      } else {
        orgId = orgs[0].id;
      }
    }

    // 2) Ensure a mission exists for that org (create if none)
    let missionId = null;
    {
      const { data: ms, error } = await s
        .from("missions")
        .select("id")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) return json(500, { error: "missions select failed", details: error });

      if (!ms?.length) {
        const payload = {
          org_id: orgId,
          title: "Demo Mission – Cairo Entrance Audit",
          store: "City Mall – Floor 2",
          status: "Now",
          starts_at: new Date(),
          expires_at: new Date(Date.now() + 8 * 24 * 3600 * 1000), // ≥ 7 days
          location: {
            lat: 30.0444, lng: 31.2357,
            address: "Tahrir Square, Cairo, Egypt",
            addressParts: {
              line1: "Tahrir Square", city: "Cairo",
              region: "Cairo Governorate", postalCode: "11511", country: "EG"
            }
          },
          checklist: [
            { text: "Photo of front facade", requires: { photo: true,  video: false, comment: false, timer: false } },
            { text: "30s entrance walkthrough (video)", requires: { photo: false, video: true,  comment: false, timer: true  } },
            { text: "Staff greeting notes",              requires: { photo: false, video: false, comment: true,  timer: false } }
          ],
          budget: 100, fee: 50, requires_video: true, requires_photos: true, time_on_site_min: 10
        };
        const { data, error: insErr } = await s
          .from("missions")
          .insert(payload)
          .select("id")
          .single();
        if (insErr) return json(500, { error: "mission insert failed", details: insErr });
        missionId = data.id;
      } else {
        missionId = ms[0].id;
      }
    }

    // 3) Insert a demo submission (text-only answers; media optional)
    const submissionPayload = {
      org_id: orgId,
      mission_id: missionId,
      agent_id: "agent_123",
      started_at: new Date(Date.now() - 5 * 60 * 1000),
      submitted_at: new Date(),
      status: "Submitted",
      gps: { lat: 30.0445, lng: 31.2358, accuracy: 12 },
      device_meta: { model: "iPhone 13", os: "iOS 17" },
      answers: [
        { itemIndex: 0, text: "Photo step marked complete (no file for demo)" },
        { itemIndex: 1, text: "Walkthrough done in 32s", timerSec: 32 },
        { itemIndex: 2, text: "Greeted within 8 seconds. Store clean." }
      ]
    };

    const { data: sub, error: subErr } = await s
      .from("Completed Missions")
      .insert(submissionPayload)
      .select("id")
      .single();

    if (subErr) return json(500, { error: "submission insert failed", details: subErr });

    return json(200, {
      ok: true,
      orgId,
      missionId,
      submissionId: sub.id,
      next: {
        portal: "/portal",
        inboxHowTo: "Go to Missions → Completed Missions Inbox, paste orgId above, click Refresh."
      }
    });
  } catch (e) {
    return json(500, { error: "exception", message: String(e?.message || e) });
  }
}