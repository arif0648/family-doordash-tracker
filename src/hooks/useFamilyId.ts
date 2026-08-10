import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface FamilyIdState {
  familyId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * useFamilyId — mevcut authenticated kullanıcının hangi family_id'ye üye
 * olduğunu family_members tablosundan çözer (Bölüm 4.1). Bu, "kim kimin
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
    setState((s) => ({ ...s, loading: true, error: null }));

    supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
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
        setState({ familyId: data.family_id, loading: false, error: null });
      })
      .catch((err) => {
        if (!mounted) return;
        setState({ familyId: null, loading: false, error: (err as Error).message });
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  return state;
}
