export async function insertReportResilient(supabase, row){
  // First try with kpis
  let { error } = await supabase.from("reports").insert(row);
  if (!error) return { ok:true };

  const msg = (error?.message || "").toLowerCase();
  // If API schema doesn't know 'kpis' yet, retry without it
  if (msg.includes("kpis") || msg.includes("schema")) {
    const { kpis, ...row2 } = row;
    const r2 = await supabase.from("reports").insert(row2);
    if (r2.error) return { ok:false, error: r2.error };
    return { ok:true, downgraded:true };
  }
  return { ok:false, error };
}