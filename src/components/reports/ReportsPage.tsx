import React, { useMemo } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import { computeFamilySummary, IncomeRecord, ExpenseRecord, FixedExpenseVersion } from '../../lib/financialEngine';
import { monthBoundary, toPacificDateString } from '../../lib/timezone';
import { MileageEntry } from '../../lib/mileageEngine';
import { toCsv, downloadCsv } from '../../lib/csvExport';
import { VehicleChampions } from '../home/VehicleChampions';
import { CreditCardsDashboard } from '../home/CreditCardsDashboard';
import { supabase } from '../../lib/supabaseClient';
import { Button, PageHeader, PageShell, SectionHeader } from '../ui/primitives';

export function ReportsPage({ familyId }: { familyId: string }) {
  const { vehicles, income, expenses, mileageLog, fixedExpenses, creditCards, loading, error, retry } =
    useFamilyRealtimeData(familyId);

  const now = new Date();
  const boundary = useMemo(() => monthBoundary(now), []);
  const monthAnchor = toPacificDateString(now);

  const [trend, setTrend] = React.useState<any>(null);
  React.useEffect(() => {
    if (familyId) {
      supabase.rpc('get_financial_trend', { p_family_id: familyId }).then(({ data }) => setTrend(data?.[0]));
    }
  }, [familyId]);

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

  const vehicleNames = Object.fromEntries(vehicles.map((v) => [v.id, v.short_name]));

  function exportIncomeCsv() {
    const csv = toCsv(income, [
      { header: 'Tarih', accessor: (r) => r.record_date },
      { header: 'Araç', accessor: (r) => vehicleNames[r.vehicle_id] ?? 'Arşivlenmiş Araç' },
      { header: 'Tutar', accessor: (r) => r.amount },
      { header: 'Not', accessor: (r) => r.note ?? '' },
    ]);
    downloadCsv(`kazanc-${monthAnchor}.csv`, csv);
  }

  function exportExpensesCsv() {
    const csv = toCsv(expenses, [
      { header: 'Tarih', accessor: (r) => r.record_date },
      { header: 'Kategori', accessor: (r) => r.category },
      { header: 'Araç', accessor: (r) => (r.vehicle_id ? vehicleNames[r.vehicle_id] ?? 'Arşivlenmiş Araç' : 'Aile') },
      { header: 'Tutar', accessor: (r) => r.amount },
      { header: 'Not', accessor: (r) => r.note ?? '' },
    ]);
    downloadCsv(`gider-${monthAnchor}.csv`, csv);
  }

  function exportMileageCsv() {
    const csv = toCsv(mileageLog, [
      { header: 'Tarih', accessor: (r) => r.record_date },
      { header: 'Araç', accessor: (r) => vehicleNames[r.vehicle_id] ?? 'Arşivlenmiş Araç' },
      { header: 'Kapanış Mili', accessor: (r) => r.closing_mileage },
      { header: 'Günlük Mil', accessor: (r) => r.miles_driven },
    ]);
    downloadCsv(`kilometre-${monthAnchor}.csv`, csv);
  }

  return (
    <PageShell>
      <PageHeader title="Raporlar" description="Finans, araç ve borç görünümü." />

      <SectionHeader title="Finansal Özet" />
      {!hasAnyData ? (
        <EmptyState message="Henüz veri yok." icon="▥" />
      ) : (
        <>
          <div style={styles.grid}>
            <Stat label="Toplam Gelir" value={familySummary.totalIncome} />
            <Stat label="Toplam Gider" value={familySummary.gas + familySummary.vehicleExpense + familySummary.market + familySummary.otherFamily + familySummary.otherVehicle + familySummary.fixedExpense} />
            <Stat label="Net Sonuç" value={familySummary.net} highlight />
            <Stat label="Toplam Mil" value={totalMiles} isMiles />
          </div>

          {trend && (
            <section style={styles.trendCard}>
              <div>
                <span style={styles.trendKicker}>AYLIK TREND</span>
                <div style={{ ...styles.trendStatus, color: trend.trend_status === 'IMPROVING' ? 'var(--positive)' : trend.trend_status === 'DECLINING' ? 'var(--negative)' : 'var(--accent)' }}>
                  {trend.trend_status === 'IMPROVING' ? '↗ İLERİ' : trend.trend_status === 'DECLINING' ? '↘ GERİLEME' : '= STABİL'}
                </div>
                <div style={styles.trendMeta}>
                  Geçen ay: ${trend.previous_month_net?.toFixed(2) || '—'} • Bu ay: ${trend.current_month_net?.toFixed(2) || '—'} • Net değişim: {typeof trend.net_change === 'number' ? (trend.net_change >= 0 ? '+' : '') + trend.net_change.toFixed(2) : '—'}
                </div>
              </div>
            </section>
          )}

          <SectionHeader title="Araç Sıralaması" />
          <VehicleChampions income={incomeRecords} vehicles={vehicles} now={now} />

          <SectionHeader title="Borç Özeti" />
          <CreditCardsDashboard cards={creditCards} />

          <SectionHeader title="Dışa Aktar (CSV)" />
          <div style={styles.exportRow}>
            <Button onClick={exportIncomeCsv}>Gelir</Button>
            <Button onClick={exportExpensesCsv}>Gider</Button>
            <Button onClick={exportMileageCsv}>Kilometre</Button>
          </div>
        </>
      )}
    </PageShell>
  );
}

function Stat({ label, value, highlight, isMiles }: { label: string; value: number; highlight?: boolean; isMiles?: boolean }) {
  const color = highlight ? (value >= 0 ? 'var(--positive)' : 'var(--negative)') : 'var(--text)';
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
  page: { padding: '16px 14px var(--page-bottom-space)', color: 'var(--text)' },
  heading: { fontSize: 20, fontWeight: 750, marginBottom: 14 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  statCard: { background: '#101823', border: '1px solid var(--border)', borderRadius: 15, padding: 13, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.025)' },
  statLabel: { fontSize: 12, color: '#7F8499', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: 700, margin: 0 },
  sectionTitle: { fontSize: 15, fontWeight: 800, marginTop: 20, marginBottom: 10 },
  trendCard: { padding: 15, borderRadius: 18, background: 'linear-gradient(145deg,#111a26,#0a1018)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', marginBottom: 14 },
  trendKicker: { fontSize: 10, letterSpacing: 2, color: '#8F93A8', fontWeight: 900 },
  trendStatus: { fontSize: 22, fontWeight: 900, margin: '6px 0' },
  trendMeta: { fontSize: 12, color: '#777C91' },
  exportRow: { display: 'flex', gap: 8 },
  exportButton: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,.14)',
    background: '#101823',
    color: 'white',
    fontSize: 13,
    fontWeight: 700,
  },
};
