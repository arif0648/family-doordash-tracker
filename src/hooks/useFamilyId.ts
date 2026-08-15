import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface FamilyIdState {
  familyId: string | null;
  loading: boolean;
  error: string | null;
  membershipStatus: 'approved' | 'pending' | 'rejected' | 'none' | null;
}

/**
 * useFamilyId — mevcut authenticated kullanıcının hangi family_id'ye üye
 * olduğunu veritabanının deterministic family resolver'ından çözer. Bu, "kim kimin
 * ailesini görebilir" sorusunun tek kaynağıdır — RLS zaten bunu zorunlu
 * kılar, bu hook sadece UI'ın doğru family_id ile sorgu yapmasını sağlar.
 */
export function useFamilyId(userId: string | undefined): FamilyIdState {
  const [state, setState] = useState<FamilyIdState>({ familyId: null, loading: true, error: null, membershipStatus: null });

  useEffect(() => {
    if (!userId) {
      setState({ familyId: null, loading: false, error: null, membershipStatus: null });
      return;
    }

    let mounted = true;
    // Never keep the previous authenticated user's family in React state.
    setState({ familyId: null, loading: true, error: null, membershipStatus: null });

    const resolveMembership = async () => {
      try {
        const [{ data, error }, statusResult] = await Promise.all([
          supabase.rpc('resolve_current_family_id'), supabase.rpc('get_my_membership_status'),
        ]);

        if (!mounted) return;
        if (error) {
          setState({ familyId: null, loading: false, error: error.message, membershipStatus: null });
          return;
        }
        if (!data) {
          setState({ familyId: null, loading: false, error: null, membershipStatus: (statusResult.data ?? 'none') as FamilyIdState['membershipStatus'] });
          return;
        }
        setState({ familyId: data as string, loading: false, error: null, membershipStatus: 'approved' });
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.';
        setState({ familyId: null, loading: false, error: message, membershipStatus: null });
      }
    };

    void resolveMembership();
    const channel = supabase.channel(`membership-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'family_members', filter: `user_id=eq.${userId}` }, () => void resolveMembership())
      .subscribe();
    const onResume = () => void resolveMembership();
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return state;
}
