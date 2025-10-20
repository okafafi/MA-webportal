// lib/missions.js
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Server-side: fetch completed missions visible to the portal
 * (relies on RPC: completed_missions_for_portal(org uuid, lim int default 50))
 */
export async function fetchCompletedMissions(orgId, limit = 50) {
  if (!orgId) throw new Error("orgId is required");

  // Defensive: fail gracefully if envs are missing so the page doesn't hard-crash
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("[fetchCompletedMissions] NEXT_PUBLIC_SUPABASE_URL is missing");
    return [];
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[fetchCompletedMissions] SUPABASE_SERVICE_ROLE_KEY is missing");
    return [];
  }

  const { data, error } = await supabaseAdmin
    .rpc("completed_missions_for_portal", { org: orgId, lim: limit });

  if (error) {
    console.error("[fetchCompletedMissions] RPC error:", error);
    throw error;
  }
  return data ?? [];
}