import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser / anon client (reads/writes via RLS; for our single-user app RLS allows all)
export const supabase = createClient(url, anon, { auth: { persistSession: false } });

// Server-side admin client (only on server routes)
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}
