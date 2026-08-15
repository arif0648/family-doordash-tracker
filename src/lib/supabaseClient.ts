import { createClient } from '@supabase/supabase-js';
import { hasPasswordRecoveryParameters } from './authRedirect';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at startup rather than producing a silent blank screen later
  // (Master Instruction Bölüm 13 — never a blank white screen).
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. .env dosyasını kontrol edin.'
  );
}

// Capture this before the auth client consumes/cleans callback parameters.
// ResetPasswordPage uses it if PASSWORD_RECOVERY fired during client startup.
export const passwordRecoveryUrlDetectedAtStartup =
  typeof window !== 'undefined' && hasPasswordRecoveryParameters(window.location.href);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true, // Bölüm 14 — session refresh desteklenmeli
    detectSessionInUrl: true,
  },
});
