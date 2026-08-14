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
  RealtimeStatus,
} from '../types/database';

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
  realtimeStatus: RealtimeStatus;
}

export function shouldRefetchForRealtimeStatus(status: string): boolean {
  return status === 'SUBSCRIBED';
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
    realtimeStatus: 'connecting',
  });
  const mounted = useRef(true);
  const [retryCount, setRetryCount] = useState(0);

  const fetchAll = useCallback(async (background = false) => {
    if (!familyId) return;
    if (!background) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [v, i, e, m, f, c, a, n, ms, ws, goalRows] = await Promise.all([
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
        supabase.from('family_member_goals').select('user_id,vehicle_id,weekly_goal').eq('family_id', familyId),
      ]);
      // Finance data is the critical core. Optional dashboard modules must not
      // blank Home, Reports and Transactions when one newer table is missing,
      // temporarily unavailable or has a narrower RLS policy.
      const coreError = v.error || i.error || e.error || m.error || f.error || c.error;
      if (coreError) throw coreError;
      if (import.meta.env.DEV) {
        const optionalErrors = [a.error, n.error, ms.error, ws.error, goalRows.error].filter(Boolean);
        if (optionalErrors.length) console.warn('[family data] optional modules unavailable', optionalErrors);
      }
      const income = i.data ?? [];
      const expenses = e.data ?? [];
      const userIds = [...new Set([...income, ...expenses].map((r) => r.user_id).filter(Boolean))];
      const p = userIds.length
        ? await supabase.from('profiles').select('*').in('user_id', userIds)
        : { data: [] as Profile[], error: null };
      if (p.error && import.meta.env.DEV) console.warn('[family data] profiles unavailable', p.error);
      if (!mounted.current) return;
      const normalizedVehicles = (v.data ?? []).map(normalizeVehicle);
      setState((previous) => ({
        vehicles: normalizedVehicles,
        income,
        expenses,
        mileageLog: m.data ?? [],
        fixedExpenses: f.data ?? [],
        creditCards: c.data ?? [],
        appointments: a.error ? previous.appointments : (a.data ?? []),
        notifications: n.error ? previous.notifications : (n.data ?? []),
        monthlySummaries: ms.error ? previous.monthlySummaries : (ms.data ?? []),
        workSessions: ws.error ? previous.workSessions : (ws.data ?? []),
        profiles: p.error ? previous.profiles : (p.data ?? []),
        goals: goalRows.error ? previous.goals : (goalRows.data ?? []).map((g) => ({ ...g, display_name: '', week_income: 0, remaining: 0, percent: 0 })) as WeeklyGoalRow[],
        loading: false,
        error: null,
        realtimeStatus: previous.realtimeStatus,
      }));
    } catch (err) {
      if (!mounted.current) return;
      const message =
        err instanceof Error ? err.message :
        typeof err === 'string' ? err :
        (err as any)?.message ? (err as any).message :
        'Bilinmeyen hata';
      setState((s) => background
        ? { ...s, loading: false, realtimeStatus: 'offline' }
        : { ...s, loading: false, error: message });
    }
  }, [familyId]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!familyId) return;
    void fetchAll();

    const onRemote = () => { void fetchAll(true); };

    const channel = supabase
      .channel(`family-${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mileage_log', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_expenses', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_cards', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_card_payments', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_financial_summaries', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_member_goals', filter: `family_id=eq.${familyId}` }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles', filter: `family_id=eq.${familyId}` }, onRemote)
      .subscribe((status) => {
        if (import.meta.env.DEV) console.debug(`[realtime] ${status}`);
        setState((s) => ({ ...s, realtimeStatus: status === 'SUBSCRIBED' ? 'live' : status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED' ? 'offline' : 'connecting' }));
        if (shouldRefetchForRealtimeStatus(status)) void fetchAll(true);
      });

    const onVisibility = () => { if (document.visibilityState === 'visible') void fetchAll(true); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => { document.removeEventListener('visibilitychange', onVisibility); void supabase.removeChannel(channel); };
  }, [familyId, fetchAll, retryCount]);

  return { ...state, retry: () => setRetryCount((c) => c + 1) };
}
