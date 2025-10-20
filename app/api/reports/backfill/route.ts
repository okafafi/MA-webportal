import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackfillBody = {
  orgId?: string;
  limit?: number;
};

type BackfillItem = {
  submissionId: string;
  generated: boolean;
  reportId?: string | null;
  error?: string;
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export async function POST(req: Request) {
  const stage: Record<string, unknown> = { step: "start" };
  try {
    const body = (await req.json().catch(() => ({}))) as BackfillBody;
    const orgId = body.orgId?.trim();
    const limit = Math.max(1, Math.min(body.limit ?? 50, 500));

    if (!orgId) {
      return json(400, { ok: false, error: "orgId is required", stage });
    }

    stage.step = "fetch-submissions";
    const { data: submissions, error: subErr } = await supabaseAdmin
      .from("mission_submissions")
      .select(
        "id, org_id, mission_id, agent_id, submitted_at, meta_json, comment"
      )
      .eq("org_id", orgId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(limit);

    if (subErr) {
      return json(500, {
        ok: false,
        error: subErr.message || "Failed to load submissions",
        stage,
      });
    }

    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto =
      h.get("x-forwarded-proto") ??
      (host.includes("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;
    const autoEndpoint = `${baseUrl}/api/reports/auto`;

    const items: BackfillItem[] = [];
    let generated = 0;

    if (!submissions || submissions.length === 0) {
      return json(200, {
        ok: true,
        processed: 0,
        generated,
        items,
        stage,
      });
    }

    stage.step = "process-submissions";
    for (const submission of submissions) {
      const submissionId = submission.id;

      const { data: existing, error: existingErr } = await supabaseAdmin
        .from("reports")
        .select("id")
        .eq("org_id", orgId)
        .eq("meta->>submission_id", submissionId)
        .limit(1)
        .maybeSingle();

      if (existingErr) {
        items.push({
          submissionId,
          generated: false,
          error:
            existingErr.message ||
            "Failed to check existing report for submission",
        });
        continue;
      }

      if (existing?.id) {
        items.push({
          submissionId,
          generated: false,
          reportId: existing.id,
        });
        continue;
      }

      try {
        const resp = await fetch(autoEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: submission.org_id,
            missionId: submission.mission_id,
            agentId: submission.agent_id,
            submissionId,
          }),
        });

        const payload = await resp.json().catch(() => ({}));

        if (!resp.ok || payload?.ok !== true) {
          const message =
            payload?.error ||
            `Auto generator returned status ${resp.status}`;
          items.push({
            submissionId,
            generated: false,
            error: message,
          });
          continue;
        }

        generated += 1;
        items.push({
          submissionId,
          generated: true,
          reportId: payload?.report_id ?? null,
        });
      } catch (err: any) {
        items.push({
          submissionId,
          generated: false,
          error: String(err?.message || err),
        });
      }
    }

    stage.step = "done";
    return json(200, {
      ok: true,
      processed: submissions.length,
      generated,
      items,
    });
  } catch (err: any) {
    return json(500, {
      ok: false,
      error: String(err?.message || err),
      stage,
    });
  }
}

/**
 * NOTE: Add the following index in Supabase SQL to guard against duplicates:
 * create unique index if not exists reports_unique_submission
 * on reports ((meta->>'submission_id'))
 * where meta ? 'submission_id';
 */
