import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  // back to where the sign-in started (a claim link), same site only: "/x" yes, "//evil" and "https://" no
  const next = url.searchParams.get("next");
  const safe = next && /^\/(?![\/\\])/.test(next) ? next : "/squad";
  return NextResponse.redirect(new URL(safe, url.origin));
}
