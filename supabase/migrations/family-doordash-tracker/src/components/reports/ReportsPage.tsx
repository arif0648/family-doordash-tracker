import React, { useMemo } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import { computeFamilySummary, computeVehicleSummary, IncomeRecord, ExpenseRecord, FixedExpenseVersion } from '../../lib/financialEngine';
import { monthBoundary, toPacificDateString } from '../../lib/timezone';
import { sumMilesInPeriod, MileageEntry } from '../../lib/mileageEngine';
import { toCsv, downloadCsv } from '../../lib/csvExport';
import { Leaderboard } from '../leaderboard/Leaderboard';

export function ReportsPage({ familyId }: { familyId: string }) {
  const { vehicles, income, expenses, mileageLog, fixedExpenses, loading, error, retry } =
    useFamilyRealtimeData(familyId);

  const now = new Date();
  const boundary = useMemo(() => monthBoundary(now), []);
  const monthAnchor = toPacificDateString(now);

  if (loading) return <LoadingScreen label="Raporlar hazırlanıyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  const incomeRecords: IncomeRecord[] = income.map((r) => ({ id: r.id, vehicleId: r.vehicle_id, amount: r.amount, recordDate: r.record_date }));
  const expenseRecords: ExpenseRecord[] = expenses.map((r) => ({ id: r.id, category: r.category, vehicleId: r.vehicle_id, amount: r.amount, recordDate: r.record_date }));
  const fixedVersions: FixedExpenseVersion[] = fixedExpenses.map((f) => ({ id: f.id, label: f.label, monthlyAmount: f.monthly_amount, effectiveFrom: f.effective_from, effectiveTo: f.effective_to }));
  const mileageEntries: MileageEntry[] = mileageLog.map((m) => ({ id: m.id, vehicleId: m.vehicle_id, recordDate: m.record_date, createdAt: m.created_at, closingMileage: m.closing_mileage, milesDriven: m.miles_driven }));

  const hasAnyData = income.length > 0 || expenses.length > 0;

  const familySummary = computeFamilySummary({
    period: 'month',
    boundary,
    income: incomeRecords,
    expenses: expenseRecords,
    fixedExpenseVersions: fixedVersions,
    monthAnchorDate: monthAnchor,
  });

  const totalMiles = mileageEntries
    .filter((m) => m.recordDate >= boundary.start && m.recordDate <= boundary.end)
    .reduce((s, m) => s + m.milesDriven, 0);

  const vehicleSummaries = vehicles.map((v) =>
    computeVehicleSummary({
      vehicle: { id: v.id, shortName: v.short_name },
      period: 'month',
      boundary,
      income: incomeRecords,
      expenses: expenseRecords,
      fixedExpenseVersions: fixedVersions,
      monthAnchorDate: monthAnchor,
      totalVehicleCount: vehicles.length,
      milesInPeriod: sumMilesInPeriod(mileageEntries.filter((m) => m.vehicleId === v.id), boundary.start, boundary.end),
    })
  );
  const vehicleNames = Object.fromEntries(vehicles.map((v) => [v.id, v.short_name]));

  function exportIncomeCsv() {
    const csv = toCsv(income, [
      { header: 'Tarih', accessor: (r) => r.record_date },
      { header: 'Araç', accessor: (r) => vehicleNames[r.vehicle_id] ?? r.vehicle_id },
      { header: 'Tutar', accessor: (r) => r.amount },
      { header: 'Not', accessor: (r) => r.note ?? '' },
    ]);
    downloadCsv(`kazanc-${monthAnchor}.csv`, csv);
  }

  function exportExpensesCsv() {
    const csv = toCsv(expenses, [
      { header: 'Tarih', accessor: (r) => r.record_date },
      { header: 'Kategori', accessor: (r) => r.category },
      { header: 'Araç', accessor: (r) => (r.vehicle_id ? vehicleNames[r.vehicle_id] ?? r.vehicle_id : 'Aile') },
      { header: 'Tutar', accessor: (r) => r.amount },
      { header: 'Not', accessor: (r) => r.note ?? '' },
    ]);
    downloadCsv(`gider-${monthAnchor}.csv`, csv);
  }

  function exportMileageCsv() {
    const csv = toCsv(mileageLog, [
      { header: 'Tarih', accessor: (r) => r.record_date },
      { header: 'Araç', accessor: (r) => vehicleNames[r.vehicle_id] ?? r.vehicle_id },
      { header: 'Kapanış Mili', accessor: (r) => r.closing_mileage },
      { header: 'Günlük Mil', accessor: (r) => r.miles_driven },
    ]);
    downloadCsv(`kilometre-${monthAnchor}.csv`, csv);
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Raporlar</h1>

      {!hasAnyData ? (
        <EmptyState message="Henüz veri yok." icon="📊" />
      ) : (
        <>
          <div style={styles.grid}>
            <Stat label="Toplam Kazanç" value={familySummary.totalIncome} />
            <Stat label="Toplam Gider" value={familySummary.gas + familySummary.vehicleExpense + familySummary.market + familySummary.otherFamily + familySummary.otherVehicle + familySummary.fixedExpense} />
            <Stat label="Net Sonuç" value={familySummary.net} highlight />
            <Stat label="Toplam Mil" value={totalMiles} isMiles />
          </div>

          <h2 style={styles.sectionTitle}>Araç Karşılaştırması</h2>
          <Leaderboard title="AYIN 1.'Sİ" vehicleSummaries={vehicleSummaries} vehicleNames={vehicleNames} hasAnyRealActivity={hasAnyData} />

          <h2 style={styles.sectionTitle}>Dışa Aktar (CSV)</h2>
          <div style={styles.exportRow}>
            <button style={styles.exportButton} onClick={exportIncomeCsv}>Kazanç</button>
            <button style={styles.exportButton} onClick={exportExpensesCsv}>Gider</button>
            <button style={styles.exportButton} onClick={exportMileageCsv}>Kilometre</button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight, isMiles }: { label: string; value: number; highlight?: boolean; isMiles?: boolean }) {
  const color = highlight ? (value >= 0 ? '#22C55E' : '#F87171') : '#E2E8F0';
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={{ ...styles.statValue, color }}>
        {isMiles ? `${value.toLocaleString('en-US')} mi` : `${value >= 0 ? '' : '-'}$${Math.abs(value).toLocaleString('en-US')}`}
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '16px 16px 96px', color: 'white' },
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  statCard: { background: '#151B2C', borderRadius: 16, padding: 14 },
  statLabel: { fontSize: 12, color: '#64748B', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: 700, margin: 0 },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 10 },
  exportRow: { display: 'flex', gap: 8 },
  exportButton: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 12,
    border: '1px solid #1E293B',
    background: '#151B2C',
    color: 'white',
    fontSize: 13,
    fontWeight: 600,
  },
};
