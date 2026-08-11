import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at startup rather than producing a silent blank screen later
  // (Master Instruction Bölüm 13 — never a blank white screen).
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. .env dosyasını kontrol edin.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true, // Bölüm 14 — session refresh desteklenmeli
    detectSessionInUrl: true,
  },
});
