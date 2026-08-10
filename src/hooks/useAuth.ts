import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string | null;
}

/**
 * useAuth — auth initialization + session refresh (Bölüm 14).
 * "loading" başlangıçta true'dur; bu, App.tsx'in blank-screen yerine
 * her zaman bir yükleniyor ekranı göstermesini sağlar (Bölüm 13).
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, error: null });

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setState({ session: null, loading: false, error: error.message });
          return;
        }
        setState({ session: data.session, loading: false, error: null });
      })
      .catch((err) => {
        if (!mounted) return;
        setState({ session: null, loading: false, error: (err as Error).message });
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({ session, loading: false, error: null });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return state;
}
