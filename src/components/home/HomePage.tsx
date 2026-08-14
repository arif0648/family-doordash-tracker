import React, { useEffect, useMemo, useState } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import { WorkTimeCard } from './WorkTimeCard';
import { Upcoming7Days } from './Upcoming7Days';
import { WeeklyGoalCard } from './WeeklyGoalCard';
import { VehicleChampions } from './VehicleChampions';
import { MarketRatesStrip } from './MarketRatesStrip';
import { computeFamilySummary, Period, IncomeRecord, ExpenseRecord, FixedExpenseVersion } from '../../lib/financialEngine';
import { boundaryForPeriod, toPacificDateString, weekBoundary, todayBoundary } from '../../lib/timezone';
import { formatMoney } from '../../lib/format';
import { NavLink, useSearchParams } from 'react-router-dom';

const labels: Record<Period, string> = { today: 'Bugün', week: 'Bu Hafta', month: 'Bu Ay' };
const summaryLabels: Record<Period, string> = { today: 'BUGÜNÜN ÖZETİ', week: 'HAFTANIN ÖZETİ', month: 'AYIN ÖZETİ' };

interface HomePageProps {
  familyId: string;
}

export function HomePage({ familyId }: HomePageProps) {
  const { income, expenses, fixedExpenses, vehicles, creditCards, appointments, workSessions, goals, loading, error, retry, realtimeStatus } = useFamilyRealtimeData(familyId);
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
  const timeLabel = now.toLocaleTimeString('tr-TR', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
  });

  const net = selectedSummary.net;
  const isPositive = net >= 0;
  const lastMovement = [...income.map((r) => ({ at: r.created_at, amount: Number(r.amount), label: vehicles.find((v) => v.id === r.vehicle_id)?.short_name ?? 'Araç' })), ...expenses.map((r) => ({ at: r.created_at, amount: -Number(r.amount), label: r.vehicle_id ? vehicles.find((v) => v.id === r.vehicle_id)?.short_name ?? 'Araç' : r.category === 'market' ? 'Market' : 'Aile' }))].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
  const lastMinutes = lastMovement ? Math.max(0, Math.floor((now.getTime() - new Date(lastMovement.at).getTime()) / 60_000)) : null;

  return (
    <main className="home-page" style={S.page}>
      <header className="home-glass" style={S.identity}>
        <div style={S.identityShine} />
        <div style={S.identityCopy}>
          <h1 style={S.title}>BARBIN AİLESİ</h1>
          <div style={S.identityMeta}>
            <time dateTime={monthAnchor} style={S.date}>{todayLabel}</time>
            <span style={S.metaDot} aria-hidden="true" />
            <time dateTime={now.toISOString()} style={S.time}>{timeLabel}</time>
          </div>
        </div>
      </header>

      <MarketRatesStrip realtimeStatus={realtimeStatus} />

      <div className="home-glass" style={S.periods}>
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setParams({ period: p })}
            style={{
              ...S.period,
              background: period === p ? 'rgba(60,200,237,.12)' : 'transparent',
              color: period === p ? 'var(--text)' : 'var(--text-secondary)',
              boxShadow: period === p ? 'inset 0 0 0 1px rgba(60,200,237,.28), 0 5px 18px rgba(60,200,237,.06)' : 'none',
            }}
          >
            {labels[p]}
          </button>
        ))}
      </div>

      <section className="home-glass" style={S.netCard}>
        <span style={S.netKicker}>{summaryLabels[period]}</span>
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
        {lastMovement && <div style={S.lastMovement}><span style={S.activityDot} />Son hareket <b style={S.activityAmount}>{lastMovement.amount >= 0 ? '+' : '−'}{formatMoney(Math.abs(lastMovement.amount), true)}</b><span>·</span><span style={S.activityLabel}>{lastMovement.label}</span><span>·</span><span>{lastMinutes === 0 ? 'şimdi' : `${lastMinutes} dk önce`}</span></div>}
      </section>

      <div style={S.quickTop}>
        <NavLink className="home-pressable" to="/kazanc" style={{ ...S.quickBtn, ...S.incomeBtn }}>
          ＋ Gelir Ekle
        </NavLink>
        <NavLink className="home-pressable" to="/gider" style={{ ...S.quickBtn, ...S.expenseBtn }}>
          − Gider Ekle
        </NavLink>
      </div>

      <WeeklyGoalCard goals={goals} income={inc} vehicles={vehicles} now={now} />


      <VehicleChampions income={inc} vehicles={vehicles} now={now} />

      <WorkTimeCard familyId={familyId} todayIncome={todaySummary.totalIncome} weekIncome={weekSummary.totalIncome} workSessions={workSessions} onSessionsChanged={retry} />

      <Upcoming7Days creditCards={creditCards} fixedExpenses={fixedExpenses} appointments={appointments} />
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '16px 14px var(--page-bottom-space)', color: 'var(--text)', minHeight: '100vh' },
  identity: { position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', minHeight: 86, marginBottom: 10, padding: '15px 18px 13px', borderRadius: 20, textAlign: 'center', background: 'linear-gradient(150deg,rgba(19,29,42,.96),rgba(8,13,20,.985))' },
  identityShine: { position: 'absolute', inset: '0 12% auto', height: 1, background: 'linear-gradient(90deg,transparent,rgba(215,173,97,.55),transparent)', boxShadow: '0 1px 16px rgba(215,173,97,.1)' },
  identityCopy: { position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  identityMeta: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4 },
  metaDot: { width: 3, height: 3, borderRadius: 99, background: 'rgba(215,173,97,.6)' },
  lastMovement: { minWidth: 0, marginTop: 14, paddingTop: 11, borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' },
  activityDot: { width: 5, height: 5, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 9px rgba(60,200,237,.45)' },
  activityAmount: { color: 'var(--text)', fontWeight: 750 },
  activityLabel: { overflow: 'hidden', textOverflow: 'ellipsis' },
  title: { fontSize: 21, lineHeight: 1.1, fontWeight: 790, letterSpacing: 2.1, textTransform: 'uppercase', margin: 0, color: '#c6a15b', textShadow: '0 2px 16px rgba(198,161,91,.07)' },
  date: { fontSize: 10, color: 'var(--text-secondary)' },
  time: { fontSize: 10, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' },
  periods: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, padding: 4, borderRadius: 15, marginBottom: 14 },
  period: { minHeight: 40, padding: '9px 4px', textAlign: 'center', borderRadius: 11, border: 0, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 12, fontWeight: 750, background: 'transparent', transition: 'color 160ms ease, background 160ms ease, box-shadow 160ms ease' },
  netCard: { padding: '18px 18px 14px', borderRadius: 'var(--radius-card)', marginBottom: 10, textAlign: 'center' },
  netKicker: { fontSize: 10, letterSpacing: 1.35, color: '#d7dee8', fontWeight: 740 },
  netValue: { fontSize: 'clamp(38px,11vw,44px)', fontWeight: 800, letterSpacing: -1.8, margin: '5px 0 10px', fontVariantNumeric: 'tabular-nums' },
  netRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 10px' },
  netCell: { display: 'flex', flexDirection: 'column', gap: 4 },
  netLabel: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 },
  netAmount: { fontSize: 16, fontWeight: 750 },
  quickTop: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 },
  quickBtn: {
    padding: '14px 12px',
    borderRadius: 15,
    color: 'var(--text)',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 750,
    textDecoration: 'none',
    border: '1px solid var(--border)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.045)',
    transition: 'transform 120ms ease, background 120ms ease',
  },
  incomeBtn: { background: 'linear-gradient(135deg,rgba(53,201,121,.16),rgba(15,22,32,.76))', color: '#79dda7', borderColor: 'rgba(53,201,121,.22)' },
  expenseBtn: { background: 'linear-gradient(135deg,rgba(239,111,108,.13),rgba(15,22,32,.76))', color: '#ef8b88', borderColor: 'rgba(239,111,108,.2)' },
};
