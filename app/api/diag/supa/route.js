import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const DISABLED = process.env.NODE_ENV === "production";
export const dynamic = "force-dynamic";

export async function GET() {
  if (DISABLED) {
    return NextResponse.json(
      { ok: false, error: "Disabled in production" },
      { status: 404 }
    );
  }

  try {
    const { error } = await supabaseAdmin.rpc("now");
    return NextResponse.json({
      env: {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      connectable: !error,
    });
  } catch (e) {
    return NextResponse.json(
      {
        env: {
          hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
        connectable: false,
        error: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
