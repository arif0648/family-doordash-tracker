import React, { useMemo, useState } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import {
  computeFamilySummary,
  computeVehicleSummary,
  Period,
  IncomeRecord,
  ExpenseRecord,
  FixedExpenseVersion,
} from '../../lib/financialEngine';
import { boundaryForPeriod, toPacificDateString, weekBoundary } from '../../lib/timezone';
import { sumMilesInPeriod, MileageEntry } from '../../lib/mileageEngine';
import { VehicleCard } from './VehicleCard';

const PERIOD_LABELS: Record<Period, string> = { today: 'Bugün', week: 'Bu Hafta', month: 'Bu Ay' };

export function HomePage({ familyId }: { familyId: string }) {
  const { vehicles, income, expenses, mileageLog, fixedExpenses, loading, error, retry } =
    useFamilyRealtimeData(familyId);
  const [period, setPeriod] = useState<Period>('today');

  const now = new Date();
  const boundary = useMemo(() => boundaryForPeriod(period, now), [period]);
  const monthAnchor = toPacificDateString(now);
  const week = useMemo(() => weekBoundary(now), []);

  const incomeRecords: IncomeRecord[] = income.map((r) => ({
    id: r.id,
    vehicleId: r.vehicle_id,
    amount: r.amount,
    recordDate: r.record_date,
  }));
  const expenseRecords: ExpenseRecord[] = expenses.map((r) => ({
    id: r.id,
    category: r.category,
    vehicleId: r.vehicle_id,
    amount: r.amount,
    recordDate: r.record_date,
  }));
  const fixedVersions: FixedExpenseVersion[] = fixedExpenses.map((f) => ({
    id: f.id,
    label: f.label,
    monthlyAmount: f.monthly_amount,
    effectiveFrom: f.effective_from,
    effectiveTo: f.effective_to,
  }));
  const mileageEntries: MileageEntry[] = mileageLog.map((m) => ({
    id: m.id,
    vehicleId: m.vehicle_id,
    recordDate: m.record_date,
    createdAt: m.created_at,
    closingMileage: m.closing_mileage,
    milesDriven: m.miles_driven,
  }));

  if (loading) return <LoadingScreen label="Aile verileri yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  const familySummary = computeFamilySummary({
    period,
    boundary,
    income: incomeRecords,
    expenses: expenseRecords,
    fixedExpenseVersions: fixedVersions,
    monthAnchorDate: monthAnchor,
  });

  const netColor = familySummary.net >= 0 ? '#22C55E' : '#F87171';
  const netSign = familySummary.net >= 0 ? '+' : '';

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>AİLE NET DURUMU</h1>

      <div style={styles.segmented}>
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              ...styles.segmentButton,
              background: period === p ? '#22C55E' : 'transparent',
              color: period === p ? '#0B1120' : '#94A3B8',
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {period === 'week' && (
        <p style={styles.paydayNote}>Ödeme günü: Pazartesi 23:00 (Pacific)</p>
      )}

      <div style={styles.netCard}>
        <p style={{ ...styles.netAmount, color: netColor }}>
          {netSign}${Math.abs(familySummary.net).toLocaleString('en-US', { minimumFractionDigits: 0 })}
        </p>
      </div>

      <div style={styles.grid}>
        <SummaryCard label="Toplam Kazanç" value={familySummary.totalIncome} positive />
        <SummaryCard label="Benzin" value={-familySummary.gas} />
        <SummaryCard label="Araç Gideri" value={-familySummary.vehicleExpense} />
        <SummaryCard label="Market" value={-familySummary.market} />
        {period === 'month' && <SummaryCard label="Sabit Gider" value={-familySummary.fixedExpense} />}
      </div>

      <h2 style={styles.sectionTitle}>Araçlar</h2>
      <div style={styles.vehicleList}>
        {vehicles.map((vehicle) => {
          const vSummary = computeVehicleSummary({
            vehicle: { id: vehicle.id, shortName: vehicle.short_name },
            period,
            boundary,
            income: incomeRecords,
            expenses: expenseRecords,
            fixedExpenseVersions: fixedVersions,
            monthAnchorDate: monthAnchor,
            totalVehicleCount: vehicles.length,
            milesInPeriod: sumMilesInPeriod(
              mileageEntries.filter((m) => m.vehicleId === vehicle.id),
              boundary.start,
              boundary.end
            ),
          });
          return (
            <VehicleCard
              key={vehicle.id}
              shortName={vehicle.short_name}
              summary={vSummary}
              showFixedShare={period === 'month'}
            />
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  const color = positive ? '#22C55E' : value < 0 ? '#F87171' : '#94A3B8';
  const sign = value > 0 ? '+' : '';
  return (
    <div style={styles.summaryCard}>
      <p style={styles.summaryLabel}>{label}</p>
      <p style={{ ...styles.summaryValue, color }}>
        {sign}${Math.abs(value).toLocaleString('en-US')}
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '16px 16px 96px', color: 'white' },
  heading: { fontSize: 13, letterSpacing: 1, color: '#64748B', fontWeight: 600, marginBottom: 12 },
  segmented: {
    display: 'flex',
    background: '#151B2C',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  segmentButton: {
    flex: 1,
    padding: '8px 0',
    borderRadius: 8,
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
  paydayNote: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  netCard: { padding: '24px 0', textAlign: 'center' },
  netAmount: { fontSize: 44, fontWeight: 800, margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 },
  summaryCard: { background: '#151B2C', borderRadius: 16, padding: 14 },
  summaryLabel: { fontSize: 12, color: '#64748B', marginBottom: 6 },
  summaryValue: { fontSize: 20, fontWeight: 700, margin: 0 },
  sectionTitle: { fontSize: 16, fontWeight: 700, marginTop: 24, marginBottom: 10 },
  vehicleList: { display: 'flex', flexDirection: 'column', gap: 10 },
};
