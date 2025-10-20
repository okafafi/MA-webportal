// app/api/orgs/latest/route.js
import { supabaseService } from "../../../../lib/supabase";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (s,o)=>new Response(JSON.stringify(o,null,2),{status:s,headers:{'Content-Type':'application/json'}});

export async function GET(){
  const s = supabaseService();
  const { data, error } = await s
    .from("orgs")
    .select("id,name,created_at")
    .order("created_at", { ascending:false })
    .limit(1);
  if (error) return json(500,{ error:error.message });
  if (!data?.length) return json(404,{ error:"no orgs yet" });
  return json(200,{ ok:true, org: data[0] });
}