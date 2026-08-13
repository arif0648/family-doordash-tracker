import React, { useMemo } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import { FixedExpensesSummary } from './FixedExpensesSummary';
import { VehicleCard } from './VehicleCard';
import { VehicleComparison } from './VehicleComparison';
import { MarketRatesMini } from './MarketRatesMini';
import { computeFamilySummary, computeVehicleSummary, Period, IncomeRecord, ExpenseRecord, FixedExpenseVersion } from '../../lib/financialEngine';
import { boundaryForPeriod, toPacificDateString } from '../../lib/timezone';
import { NavLink, useSearchParams } from 'react-router-dom';

const labels: Record<Period, string> = { today: 'Bugün', week: 'Bu Hafta', month: 'Bu Ay' };

export function HomePage({ familyId }: { familyId: string }) {
  const { income, expenses, fixedExpenses, mileageLog, vehicles, loading, error, retry } = useFamilyRealtimeData(familyId);
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
  const net = summary.net;

  const vehicleSummaries = vehicles.map((v) => {
    const miles = mileageLog
      .filter((m) => m.vehicle_id === v.id && m.record_date >= boundary.start && m.record_date <= boundary.end)
      .reduce((s, m) => s + Number(m.miles_driven), 0);
    return computeVehicleSummary({
      vehicle: { ...v, shortName: v.short_name },
      period,
      boundary,
      income: inc,
      expenses: exp,
      fixedExpenseVersions: fixed,
      monthAnchorDate: monthAnchor,
      totalVehicleCount: Math.max(vehicles.length, 1),
      milesInPeriod: miles,
    });
  });

  const isPositive = net >= 0;

  return (
    <main style={S.page}>
      <MarketRatesMini />

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

      <section style={{ ...S.netCard, borderColor: isPositive ? 'rgba(16,185,129,.25)' : 'rgba(244,63,94,.25)' }}>
        <span style={S.netKicker}>AİLE NET DURUMU (NET KAZANÇ)</span>
        <div style={{ ...S.netValue, color: isPositive ? '#10B981' : '#F43F5E' }}>
          {isPositive ? '' : '−'}${Math.abs(net).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <p style={S.netSub}>San Ramon &amp; Blackhawk Aile Filosu</p>

        <div style={S.stats}>
          <div style={S.stat}>
            <span style={S.statLabel}>↗ TOPLAM KAZANÇ</span>
            <b style={{ ...S.statValue, color: '#10B981' }}>${summary.totalIncome.toLocaleString('en-US')}</b>
          </div>
          <div style={S.stat}>
            <span style={S.statLabel}>↘ TOPLAM GİDER</span>
            <b style={{ ...S.statValue, color: '#F43F5E' }}>${(summary.gas + summary.vehicleExpense + summary.market + summary.otherFamily + summary.otherVehicle + summary.fixedExpense).toLocaleString('en-US')}</b>
          </div>
        </div>
      </section>

      <div style={S.actions}>
        <NavLink to="/kazanc" style={{ ...S.btn, background: 'linear-gradient(135deg,#10B981,#059669)' }}>
          ＋ KAZANÇ EKLE
        </NavLink>
        <NavLink to="/gider" style={{ ...S.btn, background: 'linear-gradient(135deg,#F43F5E,#E11D48)' }}>
          ＋ GİDER EKLE
        </NavLink>
      </div>

      <h2 style={S.sectionTitle}>Araç Performansı</h2>
      <div style={S.vehicleGrid}>
        {vehicleSummaries.map((s, i) => (
          <VehicleCard key={s.vehicleId} vehicle={vehicles[i]} summary={s} />
        ))}
      </div>

      <FixedExpensesSummary expenses={fixedExpenses} />
      <VehicleComparison summaries={vehicleSummaries} />
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '18px 14px calc(112px + env(safe-area-inset-bottom))', color: '#E8EAF2', paddingBottom: 'calc(130px + env(safe-area-inset-bottom))' },
  periods: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, padding: 5, borderRadius: 17, background: '#141926', border: '1px solid rgba(255,255,255,.07)', marginBottom: 12 },
  period: { padding: '12px 4px', textAlign: 'center', borderRadius: 12, border: 0, color: '#8A90A6', textDecoration: 'none', fontSize: 12, fontWeight: 800 },
  netCard: { padding: 22, borderRadius: 24, background: 'linear-gradient(145deg, rgba(20,25,38,.96), rgba(7,9,21,.98))', border: '1px solid', boxShadow: '0 24px 65px rgba(0,0,0,.4)', marginBottom: 14, textAlign: 'center' },
  netKicker: { fontSize: 11, letterSpacing: 2, color: '#38BDF8', fontWeight: 900 },
  netValue: { fontSize: 48, fontWeight: 900, letterSpacing: -2, margin: '10px 0 6px' },
  netSub: { fontSize: 13, color: '#8A90A6', margin: '0 0 18px' },
  stats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  stat: { padding: 14, borderRadius: 16, background: 'rgba(255,255,255,.04)' },
  statLabel: { display: 'block', fontSize: 10, letterSpacing: 1, color: '#8A90A6', fontWeight: 900, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: 900 },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  btn: { padding: '16px 4px', borderRadius: 16, textAlign: 'center', textDecoration: 'none', color: '#fff', fontWeight: 900, fontSize: 14, boxShadow: '0 8px 24px rgba(0,0,0,.25)' },
  sectionTitle: { fontSize: 17, fontWeight: 900, margin: '0 0 12px' },
  vehicleGrid: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 },
};
