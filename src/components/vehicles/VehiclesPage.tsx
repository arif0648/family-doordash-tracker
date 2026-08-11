import React, { useMemo, useState } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import {
  computeVehicleSummary,
  IncomeRecord,
  ExpenseRecord,
  FixedExpenseVersion,
} from '../../lib/financialEngine';
import { monthBoundary, toPacificDateString } from '../../lib/timezone';
import { sumMilesInPeriod, MileageEntry } from '../../lib/mileageEngine';
import { VehicleCard } from '../home/VehicleCard';

export function VehiclesPage({ familyId }: { familyId: string }) {
  const { vehicles, income, expenses, mileageLog, fixedExpenses, loading, error, retry } =
    useFamilyRealtimeData(familyId);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const now = new Date();
  const boundary = useMemo(() => monthBoundary(now), []);
  const monthAnchor = toPacificDateString(now);

  // Defensive guards: every array access below is null-safe, so a partial
  // data shape (e.g. vehicles loaded but income still empty) can never
  // throw and blank the screen — this is the specific bug class the user
  // reported previously on this exact tab.
  if (loading) return <LoadingScreen label="Araçlar yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;
  if (!vehicles || vehicles.length === 0) {
    return <EmptyState message="Henüz araç tanımlanmamış" icon="🚗" />;
  }

  const incomeRecords: IncomeRecord[] = (income ?? []).map((r) => ({
    id: r.id,
    vehicleId: r.vehicle_id,
    amount: r.amount,
    recordDate: r.record_date,
  }));
  const expenseRecords: ExpenseRecord[] = (expenses ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    vehicleId: r.vehicle_id,
    amount: r.amount,
    recordDate: r.record_date,
  }));
  const fixedVersions: FixedExpenseVersion[] = (fixedExpenses ?? []).map((f) => ({
    id: f.id,
    label: f.label,
    monthlyAmount: f.monthly_amount,
    effectiveFrom: f.effective_from,
    effectiveTo: f.effective_to,
  }));
  const mileageEntries: MileageEntry[] = (mileageLog ?? []).map((m) => ({
    id: m.id,
    vehicleId: m.vehicle_id,
    recordDate: m.record_date,
    createdAt: m.created_at,
    closingMileage: m.closing_mileage,
    milesDriven: m.miles_driven,
  }));

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Araçlar</h1>

      <div style={styles.list}>
        {vehicles.map((vehicle) => {
          let summary;
          try {
            summary = computeVehicleSummary({
              vehicle: { id: vehicle.id, shortName: vehicle.short_name },
              period: 'month',
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
          } catch (calcError) {
            // A calculation error for ONE vehicle must never blank the
            // whole tab — show a per-card error instead.
            return (
              <div key={vehicle.id} style={styles.cardError}>
                {vehicle.short_name}: hesaplama hatası ({(calcError as Error).message})
              </div>
            );
          }
          return (
            <button
              key={vehicle.id}
              style={styles.cardButton}
              onClick={() => setSelectedVehicleId(vehicle.id)}
            >
              <VehicleCard shortName={vehicle.short_name} summary={summary} showFixedShare />
            </button>
          );
        })}
      </div>

      {selectedVehicle && (
        <VehicleDetailModal
          vehicleName={selectedVehicle.short_name}
          vehicleId={selectedVehicle.id}
          income={incomeRecords.filter((r) => r.vehicleId === selectedVehicle.id)}
          expenses={expenseRecords.filter((r) => r.vehicleId === selectedVehicle.id)}
          mileageEntries={mileageEntries.filter((m) => m.vehicleId === selectedVehicle.id)}
          onClose={() => setSelectedVehicleId(null)}
        />
      )}
    </div>
  );
}

function VehicleDetailModal({
  vehicleName,
  income,
  expenses,
  mileageEntries,
  onClose,
}: {
  vehicleName: string;
  vehicleId: string;
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  mileageEntries: MileageEntry[];
  onClose: () => void;
}) {
  const combined = [
    ...income.map((r) => ({ type: 'Kazanç', date: r.recordDate, amount: r.amount })),
    ...expenses.map((r) => ({ type: r.category, date: r.recordDate, amount: -r.amount })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{vehicleName}</h2>
          <button style={styles.closeButton} onClick={onClose}>
            Geri
          </button>
        </div>

        <p style={styles.modalSubtitle}>Toplam Mil: {mileageEntries.reduce((s, m) => s + m.milesDriven, 0)} mi</p>

        {combined.length === 0 ? (
          <EmptyState message="Bu araç için henüz kayıt yok" />
        ) : (
          <div style={styles.history}>
            {combined.map((item, idx) => (
              <div key={idx} style={styles.historyRow}>
                <span>{item.type}</span>
                <span>{item.date}</span>
                <span style={{ color: item.amount >= 0 ? '#22C55E' : '#F87171' }}>
                  {item.amount >= 0 ? '+' : ''}
                  {item.amount.toLocaleString('en-US')}$
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '16px 16px 96px', color: 'white' },
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  cardButton: { background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%' },
  cardError: { background: '#3F1D1D', borderRadius: 12, padding: 14, color: '#FCA5A5', fontSize: 13 },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'flex-end',
    zIndex: 100,
  },
  modal: {
    background: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 700, margin: 0 },
  closeButton: { background: 'none', border: 'none', color: '#38BDF8', fontSize: 14 },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 4 },
  history: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  historyRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #1E293B', paddingBottom: 8 },
};
