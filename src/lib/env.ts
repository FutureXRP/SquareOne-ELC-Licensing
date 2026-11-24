/** Public environment, safe for the browser. Server-only secrets are read where they are used. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
};

export function isSupabaseConfigured(): boolean {
  return publicEnv.supabaseUrl !== "" && publicEnv.supabaseAnonKey !== "";
}
