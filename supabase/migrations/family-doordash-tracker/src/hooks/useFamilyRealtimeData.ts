import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { IncomeRow, ExpenseRow, MileageLogRow, FixedExpenseRow, Vehicle } from '../types/database';

/**
 * useFamilyRealtimeData
 *
 * TEK ve MERKEZİ realtime data hook'u (Bölüm 15 / Master Instruction 14).
 * Dashboard, Vehicles, Reports, Leaderboard ekranlarının HİÇBİRİ kendi
 * subscription'ını açmaz — hepsi bu hook'u tüketir. Bu, "duplicate realtime
 * subscription" ve "infinite render loop" hatalarını yapısal olarak
 * engeller: subscription tam olarak bir kez, familyId değiştiğinde açılır/
 * kapanır, ve component unmount olduğunda temizlenir.
 */

interface FamilyData {
  vehicles: Vehicle[];
  income: IncomeRow[];
  expenses: ExpenseRow[];
  mileageLog: MileageLogRow[];
  fixedExpenses: FixedExpenseRow[];
  loading: boolean;
  error: string | null;
}

export function useFamilyRealtimeData(familyId: string | null): FamilyData & { retry: () => void } {
  const [state, setState] = useState<FamilyData>({
    vehicles: [],
    income: [],
    expenses: [],
    mileageLog: [],
    fixedExpenses: [],
    loading: true,
    error: null,
  });

  // Guards against setting state after unmount / stale closures.
  const mountedRef = useRef(true);
  const [retryCount, setRetryCount] = useState(0);

  const fetchAll = useCallback(async () => {
    if (!familyId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [vehiclesRes, incomeRes, expensesRes, mileageRes, fixedRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('family_id', familyId),
        supabase.from('income').select('*').eq('family_id', familyId),
        supabase.from('expenses').select('*').eq('family_id', familyId),
        supabase.from('mileage_log').select('*').eq('family_id', familyId),
        supabase.from('fixed_expenses').select('*').eq('family_id', familyId),
      ]);

      const firstError =
        vehiclesRes.error || incomeRes.error || expensesRes.error || mileageRes.error || fixedRes.error;

      if (firstError) throw firstError;
      if (!mountedRef.current) return;

      setState({
        vehicles: vehiclesRes.data ?? [],
        income: incomeRes.data ?? [],
        expenses: expensesRes.data ?? [],
        mileageLog: mileageRes.data ?? [],
        fixedExpenses: fixedRes.data ?? [],
        loading: false,
        error: null,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: (err as Error).message ?? 'Bilinmeyen bir hata oluştu.',
      }));
    }
  }, [familyId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!familyId) return;
    fetchAll();

    // Exactly ONE realtime channel for this family, covering all four
    // tables. Any change re-fetches (simple + correct; avoids hand-rolled
    // merge-patch bugs). Channel is torn down on unmount / familyId change.
    const channel = supabase
      .channel(`family-${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income', filter: `family_id=eq.${familyId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `family_id=eq.${familyId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mileage_log', filter: `family_id=eq.${familyId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_expenses', filter: `family_id=eq.${familyId}` }, fetchAll)
      .subscribe();

    return () => {
      // Bölüm 15 — component unmount olduğunda subscription cleanup.
      supabase.removeChannel(channel);
    };
  }, [familyId, fetchAll, retryCount]);

  return { ...state, retry: () => setRetryCount((c) => c + 1) };
}
