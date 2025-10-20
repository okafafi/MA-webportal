// app/api/stats/route.js
import { NextResponse } from "next/server";
import { DB } from "../_data/db";

export async function GET() {
  const missions = DB.missions;
  const now = Date.now();

  const total = missions.length;
  const open = missions.filter(m => m.status === "Open").length;
  const upcoming = missions.filter(m => m.status === "Upcoming").length;
  const completed7d = missions.filter(
    m => m.status === "Completed" && (now - (m.completedAt || 0)) <= 7 * 24 * 3600 * 1000
  ).length;

  const completed = missions.filter(m => m.status === "Completed");
  const onTime = completed.filter(m => (m.completedAt || 0) <= (m.dueAt || 0)).length;
  const onTimePct = completed.length ? Math.round((onTime / completed.length) * 100) : 0;

  return NextResponse.json({
    totals: { total, open, upcoming, completed7d, onTimePct }
  });
}