import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // During build time, return a placeholder that will fail at runtime
    // This prevents build errors when env vars aren't available
    if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
      console.warn("Supabase env vars not set. Database calls will fail at runtime.");
    }
    return createClient(
      url || "https://placeholder.supabase.co",
      key || "placeholder-key",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }

  _supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _supabase;
}

export const supabase = getSupabaseClient();
