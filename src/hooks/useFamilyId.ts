import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface FamilyIdState {
  familyId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * useFamilyId — mevcut authenticated kullanıcının hangi family_id'ye üye
 * olduğunu veritabanının deterministic family resolver'ından çözer. Bu, "kim kimin
 * ailesini görebilir" sorusunun tek kaynağıdır — RLS zaten bunu zorunlu
 * kılar, bu hook sadece UI'ın doğru family_id ile sorgu yapmasını sağlar.
 */
export function useFamilyId(userId: string | undefined): FamilyIdState {
  const [state, setState] = useState<FamilyIdState>({ familyId: null, loading: true, error: null });

  useEffect(() => {
    if (!userId) {
      setState({ familyId: null, loading: false, error: null });
      return;
    }

    let mounted = true;
    // Never keep the previous authenticated user's family in React state.
    setState({ familyId: null, loading: true, error: null });

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('resolve_current_family_id');

        if (!mounted) return;
        if (error) {
          setState({ familyId: null, loading: false, error: error.message });
          return;
        }
        if (!data) {
          setState({
            familyId: null,
            loading: false,
            error: 'Henüz bir aileye üye değilsiniz. Lütfen aile yöneticinizle iletişime geçin.',
          });
          return;
        }
        setState({ familyId: data as string, loading: false, error: null });
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.';
        setState({ familyId: null, loading: false, error: message });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  return state;
}
