import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    authed: isAdminRequest(),
    supabaseConfigured: isSupabaseConfigured,
    adminPasswordSet: Boolean(process.env.ADMIN_PASSWORD),
  });
}
