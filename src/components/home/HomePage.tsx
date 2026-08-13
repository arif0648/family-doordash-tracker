import React, { useMemo, useState, useEffect } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import { CreditCardsDashboard } from './CreditCardsDashboard';
import { WeeklyGoalBar } from './WeeklyGoalBar';
import { MarketRatesMini } from './MarketRatesMini';
import { LeaderboardCard } from './LeaderboardCard';
import { Upcoming7Days } from './Upcoming7Days';
import { QuickAddButton } from './QuickAddButton';
import { computeFamilySummary, Period, IncomeRecord, ExpenseRecord, FixedExpenseVersion } from '../../lib/financialEngine';
import { boundaryForPeriod, toPacificDateString, weekBoundary, monthBoundary } from '../../lib/timezone';
import { NavLink, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

const labels: Record<Period, string> = { today: 'Bugün', week: 'Bu Hafta', month: 'Bu Ay' };

export function HomePage({ familyId }: { familyId: string }) {
  const { income, expenses, fixedExpenses, creditCards, appointments, goals, profiles, loading, error, retry } = useFamilyRealtimeData(familyId);
  const [params, setParams] = useSearchParams();
  const raw = params.get('period');
  const period: Period = raw === 'week' || raw === 'month' ? raw : 'today';
  const now = new Date();
  const boundary = useMemo(() => boundaryForPeriod(period, now), [period, now]);
  const monthAnchor = toPacificDateString(now);

  const inc: IncomeRecord[] = income.map((r) => ({ id: r.id, userId: r.user_id, vehicleId: r.vehicle_id, amount: Number(r.amount) || 0, recordDate: r.record_date }));
  const exp: ExpenseRecord[] = expenses.map((r) => ({ id: r.id, category: r.category, vehicleId: r.vehicle_id, amount: Number(r.amount) || 0, recordDate: r.record_date }));
  const fixed: FixedExpenseVersion[] = fixedExpenses.map((f) => ({ id: f.id, label: f.label, monthlyAmount: f.monthly_amount, effectiveFrom: f.effective_from, effectiveTo: f.effective_to }));

  const [trend, setTrend] = useState<any>(null);
  useEffect(() => {
    if (familyId) {
      supabase.rpc('get_financial_trend', { p_family_id: familyId }).then(({ data }) => setTrend(data?.[0]));
    }
  }, [familyId]);

  if (loading) return <LoadingScreen label="Aile verileri yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  const summary = computeFamilySummary({ period, boundary, income: inc, expenses: exp, fixedExpenseVersions: fixed, monthAnchorDate: monthAnchor });
  const todayStr = toPacificDateString(now);
  const weekB = weekBoundary(now);
  const monthB = monthBoundary(now);
  const net = summary.net;

  const trendPct = trend?.net_change && trend?.previous_month_net ? (trend.net_change / Math.abs(trend.previous_month_net)) * 100 : 0;

  return (
    <main style={S.page}>
      <header style={S.header}>
        <MarketRatesMini />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <h1 style={S.h1}>BARBİN AİLESİ</h1>
          <p style={S.sub}>Gelir, gider ve borçlar tek ekranda.</p>
        </div>
        <div style={S.live}><i />CANLI</div>
      </header>

      <div style={S.periods}>
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setParams({ period: p })}
            style={{
              ...S.period,
              border: 0,
              background: period === p ? 'linear-gradient(135deg,rgba(56,189,248,.42),rgba(37,99,235,.28))' : 'transparent',
              color: period === p ? '#fff' : '#898DA0',
            }}
          >
            {labels[p]}
          </button>
        ))}
      </div>

      <section style={{ ...S.netCard, borderColor: net >= 0 ? 'rgba(16,185,129,.35)' : 'rgba(244,63,94,.35)' }}>
        <div style={S.netLeft}>
          <span style={S.cardKicker}>{net >= 0 ? 'ARTIDAYIZ' : 'EKSİDEYİZ'}</span>
          <div style={{ ...S.net, color: net >= 0 ? '#10B981' : '#F43F5E' }}>
            {net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </div>
          <div style={S.netMeta}>
            Gelir ${summary.totalIncome.toLocaleString('en-US')} • Gider ${(summary.gas + summary.vehicleExpense + summary.market + summary.otherFamily + summary.otherVehicle).toLocaleString('en-US')} • Sabit ${summary.fixedExpense.toLocaleString('en-US')}
          </div>
        </div>
        <div style={S.netRight}>
          <span style={S.trendKicker}>AYLIK TREND</span>
          <div style={{ ...S.trendValue, color: trendPct >= 0 ? '#10B981' : '#F43F5E' }}>
            {trendPct >= 0 ? '↗' : '↘'} {Math.abs(trendPct).toFixed(0)}%
          </div>
          <div style={S.trendMeta}>
            Geçen ay ${(trend?.previous_month_net || 0).toLocaleString('en-US')}
          </div>
        </div>
      </section>

      <LeaderboardCard income={inc} profiles={profiles} today={{ start: todayStr, end: todayStr }} week={weekB} month={monthB} />

      <Upcoming7Days
        creditCards={creditCards}
        fixedExpenses={fixedExpenses}
        appointments={appointments}
      />

      <CreditCardsDashboard cards={creditCards} maxCards={2} />
      <WeeklyGoalBar goals={goals} />

      <NavLink to="/sabit-giderler" style={S.fixedLink}>
        <div>
          <strong>Aylık sabit giderler</strong>
          <span>Ev, sigorta, kredi ve diğer düzenli ödemeler</span>
        </div>
        <b>›</b>
      </NavLink>

      <QuickAddButton />
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '18px 14px calc(112px + env(safe-area-inset-bottom))', color: '#E8EAF2', paddingBottom: 'calc(140px + env(safe-area-inset-bottom))' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  h1: { fontSize: 26, letterSpacing: 2, margin: '8px 0 6px', textAlign: 'center', textTransform: 'uppercase', fontWeight: 900, color: '#E8EAF2' },
  sub: { fontSize: 12, color: '#8A90A6', margin: 0 },
  live: { fontSize: 9, letterSpacing: 1, fontWeight: 900, color: '#10B981', padding: '8px 10px', border: '1px solid rgba(16,185,129,.2)', borderRadius: 999, background: 'rgba(16,185,129,.07)' },
  periods: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, padding: 5, borderRadius: 17, background: '#141926', border: '1px solid rgba(255,255,255,.07)', marginBottom: 10 },
  period: { padding: '12px 4px', textAlign: 'center', borderRadius: 12, color: '#898DA0', textDecoration: 'none', fontSize: 12, fontWeight: 800 },
  netCard: { padding: 20, borderRadius: 24, background: '#141926', border: '1px solid', boxShadow: '0 24px 65px rgba(0,0,0,.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 14 },
  netLeft: { flex: 1, minWidth: 0 },
  netRight: { textAlign: 'right', minWidth: 90 },
  cardKicker: { fontSize: 10, letterSpacing: 2, color: '#8A90A6', fontWeight: 900 },
  net: { fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: '6px 0' },
  netMeta: { fontSize: 11, color: '#8A90A6', lineHeight: 1.4 },
  trendKicker: { fontSize: 9, letterSpacing: 1.5, color: '#8A90A6', fontWeight: 900 },
  trendValue: { fontSize: 22, fontWeight: 900, margin: '4px 0' },
  trendMeta: { fontSize: 10, color: '#8A90A6' },
  fixedLink: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 16, background: '#141926', border: '1px solid rgba(255,255,255,.07)', color: '#E8EAF2', textDecoration: 'none', marginBottom: 10 },
};
