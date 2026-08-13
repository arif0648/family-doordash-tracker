import React, { useMemo } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import { CreditCardsDashboard } from './CreditCardsDashboard';
import { WeeklyGoalCard } from './WeeklyGoalCard';
import { MarketRatesStrip } from './MarketRatesStrip';
import { LeaderboardCard } from './LeaderboardCard';
import { computeFamilySummary, Period, IncomeRecord, ExpenseRecord, FixedExpenseVersion } from '../../lib/financialEngine';
import { boundaryForPeriod, toPacificDateString, weekBoundary, monthBoundary } from '../../lib/timezone';
import { NavLink, useSearchParams } from 'react-router-dom';

const labels: Record<Period, string> = { today: 'Bugün', week: 'Bu Hafta', month: 'Bu Ay' };

export function HomePage({ familyId, userId }: { familyId: string; userId: string }) {
  const { income, expenses, fixedExpenses, creditCards, goals, loading, error, retry } = useFamilyRealtimeData(familyId);
  const [params, setParams] = useSearchParams();
  const raw = params.get('period');
  const period: Period = raw === 'week' || raw === 'month' ? raw : 'today';
  const now = new Date();
  const boundary = useMemo(() => boundaryForPeriod(period, now), [period, now]);
  const monthAnchor = toPacificDateString(now);

  const inc: IncomeRecord[] = income.map((r) => ({ id: r.id, userId: r.user_id, vehicleId: r.vehicle_id, amount: Number(r.amount) || 0, recordDate: r.record_date }));
  const exp: ExpenseRecord[] = expenses.map((r) => ({ id: r.id, category: r.category, vehicleId: r.vehicle_id, amount: Number(r.amount) || 0, recordDate: r.record_date }));
  const fixed: FixedExpenseVersion[] = fixedExpenses.map((f) => ({ id: f.id, label: f.label, monthlyAmount: f.monthly_amount, effectiveFrom: f.effective_from, effectiveTo: f.effective_to }));

  if (loading) return <LoadingScreen label="Aile verileri yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  const summary = computeFamilySummary({ period, boundary, income: inc, expenses: exp, fixedExpenseVersions: fixed, monthAnchorDate: monthAnchor });
  const todayStr = toPacificDateString(now);
  const weekB = weekBoundary(now);
  const monthB = monthBoundary(now);
  const cardDebt = creditCards.reduce((s, c) => s + Number(c.current_balance || 0), 0);
  const net = summary.net;

  return (
    <main style={S.page}>
      <header style={S.header}>
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
              background: period === p ? 'linear-gradient(135deg,rgba(168,85,247,.42),rgba(99,102,241,.28))' : 'transparent',
              color: period === p ? '#fff' : '#898DA0',
            }}
          >
            {labels[p]}
          </button>
        ))}
      </div>

      <MarketRatesStrip />

      <section style={{ ...S.netCard, borderColor: net >= 0 ? 'rgba(52,211,153,.38)' : 'rgba(127,29,29,.55)' }}>
        <div>
          <span style={S.cardKicker}>{net >= 0 ? 'ARTIDAYIZ' : 'EKSİDEYİZ'}</span>
          <div style={{ ...S.net, color: net >= 0 ? '#34D399' : '#9F1239' }}>
            {net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={S.netMeta}>
            Gelir ${summary.totalIncome.toFixed(2)} • Gider ${(summary.gas + summary.vehicleExpense + summary.market + summary.otherFamily + summary.otherVehicle).toFixed(2)} • Sabit ${summary.fixedExpense.toFixed(2)} • Kart borcu ${cardDebt.toFixed(2)}
          </div>
        </div>
        <div style={S.orb}>{net >= 0 ? '↗' : '↘'}</div>
      </section>

      <div style={S.actions}>
        <NavLink to="/kazanc" style={S.incomeBtn}>＋ Kazanç</NavLink>
        <NavLink to="/gider" style={S.expenseBtn}>− Gider</NavLink>
      </div>

      <CreditCardsDashboard cards={creditCards} />
      <WeeklyGoalCard goals={goals} userId={userId} />
      <LeaderboardCard income={inc} goals={goals} today={{ start: todayStr, end: todayStr }} week={weekB} month={monthB} />

      <NavLink to="/sabit-giderler" style={S.fixedLink}>
        <div>
          <strong>Aylık sabit giderler</strong>
          <span>Ev, sigorta, kredi ve diğer düzenli ödemeler</span>
        </div>
        <b>›</b>
      </NavLink>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '18px 14px calc(112px + env(safe-area-inset-bottom))', color: '#fff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  h1: { fontSize: 30, letterSpacing: 2, margin: '8px 0 6px', textAlign: 'center', textTransform: 'uppercase', fontWeight: 900, color: '#C4B5FD', textShadow: '0 -1px 0 #7C3AED, 0 1px 0 #5B21B6, 0 2px 0 #4C1D95, 0 3px 0 #3730A3, 0 5px 10px rgba(0,0,0,.4)' },
  sub: { fontSize: 12, color: '#7F8499', margin: 0 },
  live: { fontSize: 9, letterSpacing: 1, fontWeight: 900, color: '#34D399', padding: '8px 10px', border: '1px solid rgba(52,211,153,.2)', borderRadius: 999, background: 'rgba(52,211,153,.07)' },
  periods: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, padding: 5, borderRadius: 17, background: 'rgba(18,14,39,.86)', border: '1px solid rgba(168,85,247,.16)', marginBottom: 10 },
  period: { padding: '12px 4px', textAlign: 'center', borderRadius: 12, color: '#898DA0', textDecoration: 'none', fontSize: 12, fontWeight: 800 },
  netCard: { padding: 24, borderRadius: 24, background: 'radial-gradient(circle at 100% 0%,rgba(168,85,247,.18),transparent 45%),linear-gradient(145deg,rgba(25,18,56,.96),rgba(7,9,21,.98))', border: '1px solid', boxShadow: '0 24px 65px rgba(0,0,0,.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardKicker: { fontSize: 11, letterSpacing: 2, color: '#8F93A8', fontWeight: 900 },
  net: { fontSize: 52, fontWeight: 900, letterSpacing: -2, margin: '6px 0' },
  netMeta: { fontSize: 12, color: '#777C91', maxWidth: 360, lineHeight: 1.5 },
  orb: { width: 64, height: 64, borderRadius: 22, display: 'grid', placeItems: 'center', fontSize: 28, color: '#C084FC', background: 'rgba(168,85,247,.09)', border: '1px solid rgba(168,85,247,.24)', boxShadow: '0 0 40px rgba(168,85,247,.16)' },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 },
  incomeBtn: { padding: '13px 4px', borderRadius: 14, textAlign: 'center', textDecoration: 'none', color: '#04120D', fontWeight: 900, fontSize: 14, background: 'linear-gradient(135deg,#34D399,#10B981)' },
  expenseBtn: { padding: '13px 4px', borderRadius: 14, textAlign: 'center', textDecoration: 'none', color: '#fff', fontWeight: 900, fontSize: 14, background: 'linear-gradient(135deg,#F472B6,#EC4899)' },
  fixedLink: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 16, background: 'rgba(18,14,39,.86)', border: '1px solid rgba(168,85,247,.16)', color: '#D8B4FE', textDecoration: 'none', marginBottom: 10 },
};
