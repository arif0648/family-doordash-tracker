import React, { useEffect, useMemo, useState } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import { WorkTimeCard } from './WorkTimeCard';
import { CreditCardsDashboard } from './CreditCardsDashboard';
import { Upcoming7Days } from './Upcoming7Days';
import { FixedExpensesSummary } from './FixedExpensesSummary';
import { WeeklyGoalCard } from './WeeklyGoalCard';
import { VehicleChampions } from './VehicleChampions';
import { computeFamilySummary, Period, IncomeRecord, ExpenseRecord, FixedExpenseVersion } from '../../lib/financialEngine';
import { boundaryForPeriod, toPacificDateString, weekBoundary, todayBoundary } from '../../lib/timezone';
import { formatMoney } from '../../lib/format';
import { NavLink, useSearchParams } from 'react-router-dom';

const labels: Record<Period, string> = { today: 'Bugün', week: 'Bu Hafta', month: 'Bu Ay' };

interface HomePageProps {
  familyId: string;
}

export function HomePage({ familyId }: HomePageProps) {
  const { income, expenses, fixedExpenses, vehicles, creditCards, appointments, workSessions, goals, loading, error, retry } = useFamilyRealtimeData(familyId);
  const [params, setParams] = useSearchParams();
  const raw = params.get('period');
  const period: Period = raw === 'week' || raw === 'month' ? raw : 'today';
  const [now, setNow] = useState(() => new Date());
  const boundary = useMemo(() => boundaryForPeriod(period, now), [period, now]);
  const monthAnchor = toPacificDateString(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const inc: IncomeRecord[] = income.map((r) => ({ id: r.id, userId: r.user_id, vehicleId: r.vehicle_id, amount: Number(r.amount) || 0, recordDate: r.record_date }));
  const exp: ExpenseRecord[] = expenses.map((r) => ({ id: r.id, category: r.category, vehicleId: r.vehicle_id, amount: Number(r.amount) || 0, recordDate: r.record_date }));
  const fixed: FixedExpenseVersion[] = fixedExpenses.map((f) => ({ id: f.id, label: f.label, monthlyAmount: f.monthly_amount, effectiveFrom: f.effective_from, effectiveTo: f.effective_to }));

  useEffect(() => {
    if (loading || params.get('focus') !== 'work') return;
    const el = document.getElementById('work-card');
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      el.style.outline = '2px solid var(--accent)';
      el.style.outlineOffset = '4px';
      el.style.borderRadius = 'var(--radius-card)';
      const next = new URLSearchParams(params);
      next.delete('focus');
      setParams(next, { replace: true });
      setTimeout(() => {
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.borderRadius = '';
      }, 1500);
    });
  }, [loading, params, setParams]);

  if (loading) return <LoadingScreen label="Aile verileri yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  const selectedSummary = computeFamilySummary({ period, boundary, income: inc, expenses: exp, fixedExpenseVersions: fixed, monthAnchorDate: monthAnchor });

  const todayB = todayBoundary(now);
  const weekB = weekBoundary(now);
  const todaySummary = computeFamilySummary({ period: 'today', boundary: todayB, income: inc, expenses: exp, fixedExpenseVersions: fixed, monthAnchorDate: monthAnchor });
  const weekSummary = computeFamilySummary({ period: 'week', boundary: weekB, income: inc, expenses: exp, fixedExpenseVersions: fixed, monthAnchorDate: monthAnchor });

  const todayLabel = now.toLocaleDateString('tr-TR', {
    timeZone: 'America/Los_Angeles',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

  const net = selectedSummary.net;
  const isPositive = net >= 0;

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div>
          <h1 style={S.title}>BARBİN AİLESİ</h1>
          <p style={S.date}>{todayLabel}</p>
        </div>
      </header>

      <div style={S.periods}>
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setParams({ period: p })}
            style={{
              ...S.period,
              background: period === p ? 'var(--accent)' : 'transparent',
              color: period === p ? '#062D46' : 'var(--text-secondary)',
            }}
          >
            {labels[p]}
          </button>
        ))}
      </div>

      <section style={S.netCard}>
        <span style={S.netKicker}>DÖNEM NETİ</span>
        <div style={{ ...S.netValue, color: isPositive ? 'var(--positive)' : 'var(--negative)' }}>
          {formatMoney(net, true)}
        </div>
        <div style={S.netRow}>
          <div style={S.netCell}>
            <span style={S.netLabel}>Gelir</span>
            <b style={{ ...S.netAmount, color: 'var(--positive)' }}>{formatMoney(selectedSummary.totalIncome, true)}</b>
          </div>
          <div style={S.netCell}>
            <span style={S.netLabel}>Gider</span>
            <b style={{ ...S.netAmount, color: 'var(--negative)' }}>{formatMoney(selectedSummary.totalIncome - net, true)}</b>
          </div>
        </div>
      </section>

      <div style={S.quickTop}>
        <NavLink to="/kazanc" style={{ ...S.quickBtn, background: 'var(--positive)' }}>
          ＋ Gelir Ekle
        </NavLink>
        <NavLink to="/gider" style={{ ...S.quickBtn, background: 'var(--negative)' }}>
          − Gider Ekle
        </NavLink>
      </div>

      <WeeklyGoalCard goals={goals} income={inc} vehicles={vehicles} now={now} />


      <VehicleChampions income={inc} vehicles={vehicles} now={now} />

      <WorkTimeCard familyId={familyId} todayIncome={todaySummary.totalIncome} weekIncome={weekSummary.totalIncome} workSessions={workSessions} onSessionsChanged={retry} />

      <CreditCardsDashboard cards={creditCards} compact />

      <Upcoming7Days creditCards={creditCards} fixedExpenses={fixedExpenses} appointments={appointments} />

      <FixedExpensesSummary expenses={fixedExpenses} />
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '18px 14px calc(120px + var(--safe-bottom))', color: 'var(--text)', background: 'var(--bg)', minHeight: '100vh' },
  header: { display: 'flex', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', margin: 0, color: 'var(--text)' },
  date: { fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' },
  periods: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, padding: 5, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 14 },
  period: { padding: '12px 4px', textAlign: 'center', borderRadius: 12, border: 0, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 12, fontWeight: 800, background: 'transparent', transition: 'color 120ms ease, background 120ms ease' },
  netCard: { padding: 22, borderRadius: 'var(--radius-card)', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', marginBottom: 14, textAlign: 'center' },
  netKicker: { fontSize: 10, letterSpacing: 2, color: 'var(--accent)', fontWeight: 900 },
  netValue: { fontSize: 48, fontWeight: 900, letterSpacing: -2, margin: '10px 0 14px' },
  netRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 10px' },
  netCell: { display: 'flex', flexDirection: 'column', gap: 4 },
  netLabel: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 },
  netAmount: { fontSize: 18, fontWeight: 900 },
  quickTop: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 },
  quickBtn: {
    padding: '14px 12px',
    borderRadius: 16,
    color: '#fff',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 900,
    textDecoration: 'none',
    transition: 'transform 120ms ease, background 120ms ease',
  },
};
