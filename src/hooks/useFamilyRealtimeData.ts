import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  IncomeRow,
  ExpenseRow,
  MileageLogRow,
  FixedExpenseRow,
  Vehicle,
  CreditCardRow,
  AppointmentRow,
  NotificationRow,
  MonthlyFinancialSummaryRow,
  WorkSessionRow,
  Profile,
  WeeklyGoalRow,
} from '../types/database';
import { playIncomeSound, playExpenseSound, speak } from '../lib/sound';

// Central vehicle normalization: short_name -> shortName
function normalizeVehicle(dbVehicle: Vehicle): Vehicle {
  return {
    ...dbVehicle,
    short_name: dbVehicle.short_name,
  };
}

interface FamilyData {
  vehicles: Vehicle[];
  income: IncomeRow[];
  expenses: ExpenseRow[];
  mileageLog: MileageLogRow[];
  fixedExpenses: FixedExpenseRow[];
  creditCards: CreditCardRow[];
  appointments: AppointmentRow[];
  notifications: NotificationRow[];
  monthlySummaries: MonthlyFinancialSummaryRow[];
  workSessions: WorkSessionRow[];
  profiles: Profile[];
  goals: WeeklyGoalRow[];
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
    creditCards: [],
    appointments: [],
    notifications: [],
    monthlySummaries: [],
    workSessions: [],
    profiles: [],
    goals: [],
    loading: true,
    error: null,
  });
  const mounted = useRef(true);
  const [retryCount, setRetryCount] = useState(0);

  const fetchAll = useCallback(async () => {
    if (!familyId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [v, i, e, m, f, c, a, n, ms, ws] = await Promise.all([
        supabase.from('vehicles').select('*').eq('family_id', familyId),
        supabase.from('income').select('*').eq('family_id', familyId),
        supabase.from('expenses').select('*').eq('family_id', familyId),
        supabase.from('mileage_log').select('*').eq('family_id', familyId),
        supabase.from('fixed_expenses').select('*').eq('family_id', familyId).order('effective_from', { ascending: false }),
        supabase.from('credit_cards').select('*').eq('family_id', familyId),
        supabase.from('appointments').select('*').eq('family_id', familyId).order('start_at', { ascending: true }),
        supabase.from('notifications').select('*').eq('family_id', familyId).order('created_at', { ascending: false }).limit(50),
        supabase.from('monthly_financial_summaries').select('*').eq('family_id', familyId).order('year', { ascending: false }).order('month', { ascending: false }).limit(12),
        supabase.from('work_sessions').select('*').eq('family_id', familyId).order('started_at', { ascending: false }).limit(100),
      ]);
      const err = v.error || i.error || e.error || m.error || f.error || c.error || a.error || n.error || ms.error || ws.error;
      if (err) throw err;
      const income = i.data ?? [];
      const expenses = e.data ?? [];
      const userIds = [...new Set([...income, ...expenses].map((r) => r.user_id).filter(Boolean))];
      const p = userIds.length
        ? await supabase.from('profiles').select('*').in('user_id', userIds)
        : { data: [] as Profile[], error: null };
      if (p.error) throw p.error;
      const { data: goals, error: goalsError } = await supabase.rpc('get_family_weekly_goals', { p_family_id: familyId });
      if (goalsError) throw goalsError;
      if (!mounted.current) return;
      const normalizedVehicles = (v.data ?? []).map(normalizeVehicle);
      setState({
        vehicles: normalizedVehicles,
        income,
        expenses,
        mileageLog: m.data ?? [],
        fixedExpenses: f.data ?? [],
        creditCards: c.data ?? [],
        appointments: a.data ?? [],
        notifications: n.data ?? [],
        monthlySummaries: ms.data ?? [],
        workSessions: ws.data ?? [],
        profiles: p.data ?? [],
        goals: (goals as WeeklyGoalRow[]) ?? [],
        loading: false,
        error: null,
      });
    } catch (err) {
      if (!mounted.current) return;
      const message =
        err instanceof Error ? err.message :
        typeof err === 'string' ? err :
        (err as any)?.message ? (err as any).message :
        'Bilinmeyen hata';
      setState((s) => ({ ...s, loading: false, error: message }));
    }
  }, [familyId]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!familyId) return;
    void fetchAll();

    const onRemote = (kind: 'income' | 'expense') => {
      if (kind === 'income') {
        playIncomeSound();
        speak('Yeni kazanç eklendi.', true);
      } else {
        playExpenseSound();
        speak('Yeni gider eklendi.', true);
      }
      void fetchAll();
    };

    const channel = supabase
      .channel(`family-${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income', filter: `family_id=eq.${familyId}` }, () => onRemote('income'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `family_id=eq.${familyId}` }, () => onRemote('expense'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mileage_log', filter: `family_id=eq.${familyId}` }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_expenses', filter: `family_id=eq.${familyId}` }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_cards', filter: `family_id=eq.${familyId}` }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `family_id=eq.${familyId}` }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `family_id=eq.${familyId}` }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_financial_summaries', filter: `family_id=eq.${familyId}` }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions', filter: `family_id=eq.${familyId}` }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_member_goals', filter: `family_id=eq.${familyId}` }, () => void fetchAll())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [familyId, fetchAll, retryCount]);

  return { ...state, retry: () => setRetryCount((c) => c + 1) };
}
