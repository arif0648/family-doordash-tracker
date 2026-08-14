import React, { useMemo } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import { WorkTimeCard } from './WorkTimeCard';
import { CreditCardsDashboard } from './CreditCardsDashboard';
import { Upcoming7Days } from './Upcoming7Days';
import { FixedExpensesSummary } from './FixedExpensesSummary';
import { computeFamilySummary, Period, IncomeRecord, ExpenseRecord, FixedExpenseVersion } from '../../lib/financialEngine';
import { boundaryForPeriod, toPacificDateString, weekBoundary, todayBoundary } from '../../lib/timezone';
import { NavLink, useSearchParams } from 'react-router-dom';

const labels: Record<Period, string> = { today: 'Bugün', week: 'Bu Hafta', month: 'Bu Ay' };

export function HomePage({ familyId }: { familyId: string }) {
  const { income, expenses, fixedExpenses, creditCards, appointments, workSessions, loading, error, retry } = useFamilyRealtimeData(familyId);
  const [params, setParams] = useSearchParams();
  const raw = params.get('period');
  const period: Period = raw === 'week' || raw === 'month' ? raw : 'today';
  const now = useMemo(() => new Date(), []);
  const boundary = useMemo(() => boundaryForPeriod(period, now), [period, now]);
  const monthAnchor = toPacificDateString(now);

  const inc: IncomeRecord[] = income.map((r) => ({ id: r.id, userId: r.user_id, vehicleId: r.vehicle_id, amount: Number(r.amount) || 0, recordDate: r.record_date }));
  const exp: ExpenseRecord[] = expenses.map((r) => ({ id: r.id, category: r.category, vehicleId: r.vehicle_id, amount: Number(r.amount) || 0, recordDate: r.record_date }));
  const fixed: FixedExpenseVersion[] = fixedExpenses.map((f) => ({ id: f.id, label: f.label, monthlyAmount: f.monthly_amount, effectiveFrom: f.effective_from, effectiveTo: f.effective_to }));

  if (loading) return <LoadingScreen label="Aile verileri yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  const summary = computeFamilySummary({ period, boundary, income: inc, expenses: exp, fixedExpenseVersions: fixed, monthAnchorDate: monthAnchor });
  const net = summary.net;
  const isPositive = net >= 0;

  const todayB = todayBoundary(now);
  const weekB = weekBoundary(now);
  const todaySummary = computeFamilySummary({ period: 'today', boundary: todayB, income: inc, expenses: exp, fixedExpenseVersions: fixed, monthAnchorDate: monthAnchor });
  const weekSummary = computeFamilySummary({ period: 'week', boundary: weekB, income: inc, expenses: exp, fixedExpenseVersions: fixed, monthAnchorDate: monthAnchor });

  const todayLabel = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

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
              background: period === p ? 'linear-gradient(135deg,rgba(56,189,248,.42),rgba(37,99,235,.28))' : 'transparent',
              color: period === p ? '#fff' : '#8A90A6',
            }}
          >
            {labels[p]}
          </button>
        ))}
      </div>

      <section style={{ ...S.hero, borderColor: isPositive ? 'rgba(16,185,129,.25)' : 'rgba(244,63,94,.25)' }}>
        <span style={S.heroKicker}>AİLE NET DURUMU ({labels[period].toUpperCase()})</span>
        <div style={{ ...S.heroNet, color: isPositive ? '#10B981' : '#F43F5E' }}>
          {isPositive ? '' : '−'}${Math.abs(net).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div style={S.heroRow}>
          <div style={S.heroCell}>
            <span style={S.heroLabel}>Toplam Gelir</span>
            <b style={{ ...S.heroValue, color: '#10B981' }}>${summary.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
          </div>
          <div style={S.heroCell}>
            <span style={S.heroLabel}>Toplam Gider</span>
            <b style={{ ...S.heroValue, color: '#F43F5E' }}>${(summary.totalIncome - net).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
          </div>
        </div>
      </section>

      <div style={S.quickTop}>
        <NavLink to="/kazanc" style={{ ...S.quickBtn, background: 'linear-gradient(135deg,#10B981,#059669)' }}>
          ＋ Gelir
        </NavLink>
        <NavLink to="/gider" style={{ ...S.quickBtn, background: 'linear-gradient(135deg,#F43F5E,#E11D48)' }}>
          − Gider
        </NavLink>
      </div>

      <WorkTimeCard familyId={familyId} todayIncome={todaySummary.totalIncome} weekIncome={weekSummary.totalIncome} workSessions={workSessions} onSessionsChanged={retry} />

      <CreditCardsDashboard cards={creditCards} compact />

      <FixedExpensesSummary expenses={fixedExpenses} />

      <Upcoming7Days creditCards={creditCards} fixedExpenses={fixedExpenses} appointments={appointments} />
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '18px 14px calc(112px + var(--safe-bottom))', color: 'var(--text)', paddingBottom: 'calc(130px + var(--safe-bottom))', background: 'var(--bg)', minHeight: '100vh' },
  header: { display: 'flex', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', margin: 0, color: '#E8EAF2' },
  date: { fontSize: 12, color: '#8A90A6', margin: '4px 0 0' },
  periods: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, padding: 5, borderRadius: 17, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', marginBottom: 14 },
  period: { padding: '12px 4px', textAlign: 'center', borderRadius: 12, border: 0, color: '#8A90A6', textDecoration: 'none', fontSize: 12, fontWeight: 800 },
  hero: { padding: 22, borderRadius: 24, background: 'linear-gradient(145deg, rgba(20,25,38,.96), rgba(7,9,21,.98))', border: '1px solid', boxShadow: '0 24px 65px rgba(0,0,0,.4)', marginBottom: 14, textAlign: 'center' },
  heroKicker: { fontSize: 11, letterSpacing: 2, color: '#38BDF8', fontWeight: 900 },
  heroNet: { fontSize: 48, fontWeight: 900, letterSpacing: -2, margin: '10px 0 14px' },
  heroRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 0 0', borderTop: '1px solid rgba(255,255,255,.06)' },
  heroCell: { display: 'flex', flexDirection: 'column', gap: 4 },
  heroLabel: { fontSize: 10, letterSpacing: 1, color: '#8A90A6', fontWeight: 800 },
  heroValue: { fontSize: 20, fontWeight: 900 },
  quickTop: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 },
  quickBtn: { padding: '18px 4px', borderRadius: 18, textAlign: 'center', textDecoration: 'none', color: '#fff', fontWeight: 900, fontSize: 16, boxShadow: '0 8px 24px rgba(0,0,0,.25)' },
};
