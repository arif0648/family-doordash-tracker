import React, { useMemo, useState } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import {
  computeVehicleSummary,
  VehicleSummary,
  IncomeRecord,
  ExpenseRecord,
  FixedExpenseVersion,
} from '../../lib/financialEngine';
import { monthBoundary, toPacificDateString } from '../../lib/timezone';
import { sumMilesInPeriod, MileageEntry } from '../../lib/mileageEngine';
import { VehicleCard } from '../home/VehicleCard';
import { VehicleComparison } from '../home/VehicleComparison';
import { supabase } from '../../lib/supabaseClient';

export function VehiclesPage({ familyId }: { familyId: string }) {
  const { vehicles, income, expenses, mileageLog, fixedExpenses, loading, error, retry } =
    useFamilyRealtimeData(familyId);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  const now = new Date();
  const boundary = useMemo(() => monthBoundary(now), []);
  const monthAnchor = toPacificDateString(now);

  // Filter active vehicles only for the main list
  const activeVehicles = vehicles.filter(v => v.is_active !== false);
  const archivedVehicles = vehicles.filter(v => v.is_active === false);

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

  const vehicleSummaries = activeVehicles.map((vehicle) => {
    try {
      return computeVehicleSummary({
        vehicle: { id: vehicle.id, short_name: vehicle.short_name },
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
    } catch {
      return null;
    }
  }).filter(Boolean) as VehicleSummary[];

  return (
    <div className="app-page" style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.heading}>Araçlar</h1>
        {activeVehicles.length < 3 && (
          <button style={styles.addButton} onClick={() => setShowAddVehicle(true)}>
            + Araç Ekle
          </button>
        )}
      </div>

      {showAddVehicle && (
        <AddVehicleForm
          familyId={familyId}
          onClose={() => setShowAddVehicle(false)}
          onSaved={() => { setShowAddVehicle(false); retry(); }}
        />
      )}

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Aktif Araçlar ({activeVehicles.length}/3)</h2>
        <div style={styles.list}>
          {activeVehicles.map((vehicle) => {
            let summary;
            try {
              summary = computeVehicleSummary({
                vehicle: { id: vehicle.id, short_name: vehicle.short_name },
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
              return (
                <div key={vehicle.id} style={styles.cardError}>
                  {vehicle.short_name}: hesaplama hatası ({(calcError as Error).message})
                </div>
              );
            }
            return (
              <div
                key={vehicle.id}
                style={styles.vehicleCard}
                onClick={() => setSelectedVehicleId(vehicle.id)}
              >
                <div style={styles.vehicleHeader}>
                  <h3>{vehicle.short_name}</h3>
                  <button
                    style={styles.archiveBtn}
                    onClick={(e) => { e.stopPropagation(); handleArchive(vehicle.id); }}
                  >
                    Arşivle
                  </button>
                </div>
                <VehicleCard vehicle={vehicle} summary={summary} />
              </div>
            );
          })}
        </div>
      </div>

      {vehicleSummaries.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Araç Karşılaştırma</h2>
          <VehicleComparison summaries={vehicleSummaries} />
        </div>
      )}

      {archivedVehicles.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Arşivlenmiş Araçlar</h2>
          <div style={styles.list}>
            {archivedVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                style={styles.archivedCard}
                onClick={() => setSelectedVehicleId(vehicle.id)}
              >
                <div style={styles.vehicleHeader}>
                  <h3>{vehicle.short_name}</h3>
                  <button
                    style={styles.restoreBtn}
                    onClick={(e) => { e.stopPropagation(); handleRestore(vehicle.id); }}
                  >
                    Geri Yükle
                  </button>
                </div>
                <p style={styles.archivedNote}>Geçmiş veriler korunuyor</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedVehicle && (
        <VehicleDetailModal
          vehicle={selectedVehicle}
          income={incomeRecords.filter((r) => r.vehicleId === selectedVehicle.id)}
          expenses={expenseRecords.filter((r) => r.vehicleId === selectedVehicle.id)}
          mileageEntries={mileageEntries.filter((m) => m.vehicleId === selectedVehicle.id)}
          onClose={() => setSelectedVehicleId(null)}
        />
      )}
    </div>
  );

  async function handleArchive(vehicleId: string) {
    if (!confirm('Bu aracı arşivlemek istiyor musunuz? Geçmiş veriler korunacak.')) return;
    const { error } = await supabase.rpc('archive_vehicle', { p_vehicle_id: vehicleId });
    if (error) {
      alert('Hata: ' + error.message);
    } else {
      retry();
    }
  }

  async function handleRestore(vehicleId: string) {
    const { error } = await supabase.rpc('restore_vehicle', { p_vehicle_id: vehicleId });
    if (error) {
      alert('Hata: ' + error.message);
    } else {
      retry();
    }
  }
}

function AddVehicleForm({ familyId, onClose, onSaved }: { familyId: string; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('');
  const [shortName, setShortName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !shortName.trim()) {
      return setError('Araç adı gereklidir.');
    }
    setSaving(true);
    const { error: insertError } = await supabase.from('vehicles').insert({
      family_id: familyId,
      full_name: fullName.trim(),
      short_name: shortName.trim(),
      make: make.trim() || null,
      model: model.trim() || null,
      year: year ? Number(year) : null,
      fuel_type: fuelType || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      onSaved();
    }
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Yeni Araç Ekle</h3>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Tam Araç Adı"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Kısa Ad"
            value={shortName}
            onChange={e => setShortName(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Marka"
            value={make}
            onChange={e => setMake(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Model"
            value={model}
            onChange={e => setModel(e.target.value)}
          />
          <input
            style={styles.input}
            type="number"
            placeholder="Yıl"
            value={year}
            onChange={e => setYear(e.target.value)}
          />
          <select
            style={styles.input}
            value={fuelType}
            onChange={e => setFuelType(e.target.value)}
          >
            <option value="">Yakıt Türü Seçin</option>
            <option value="gasoline">Benzin</option>
            <option value="hybrid">Hibrit</option>
            <option value="plug_in_hybrid">Plug-in Hibrit</option>
            <option value="electric">Elektrik</option>
            <option value="diesel">Dizel</option>
            <option value="other">Diğer</option>
          </select>
          {error && <p style={styles.error}>{error}</p>}
          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>İptal</button>
            <button type="submit" style={styles.submitBtn} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VehicleDetailModal({
  vehicle,
  income,
  expenses,
  mileageEntries,
  onClose,
}: {
  vehicle: any;
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  mileageEntries: MileageEntry[];
  onClose: () => void;
}) {
  const combined = [
    ...income.map((r) => ({ type: 'Gelir', date: r.recordDate, amount: r.amount })),
    ...expenses.map((r) => ({ type: r.category, date: r.recordDate, amount: -r.amount })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{vehicle.short_name}</h2>
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
                <span style={{ color: item.amount >= 0 ? '#A855F7' : '#F87171' }}>
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
  page: { padding: '16px 14px calc(116px + var(--safe-bottom))', color: 'var(--text)', maxWidth: 680, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heading: { fontSize: 20, fontWeight: 700, margin: 0 },
  addButton: { border: '1px solid rgba(141,114,220,.22)', borderRadius: 12, padding: '10px 14px', background: 'rgba(141,114,220,.12)', color: '#c5b8eb', fontWeight: 750, fontSize: 13 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#A7ABC0', marginBottom: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  vehicleCard: { background: '#101823', borderRadius: 17, padding: 15, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' },
  vehicleHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  archivedCard: { background: 'rgba(16,24,35,.62)', borderRadius: 17, padding: 15, border: '1px solid var(--border)' },
  archivedNote: { fontSize: 12, color: '#6F748A', margin: '8px 0 0 0' },
  archiveBtn: { border: 0, borderRadius: 8, padding: '6px 12px', background: 'rgba(251,113,133,.1)', color: '#FDA4AF', fontSize: 11 },
  restoreBtn: { border: 0, borderRadius: 8, padding: '6px 12px', background: 'rgba(52,211,153,.1)', color: '#34D399', fontSize: 11 },
  cardError: { background: '#3F1D1D', borderRadius: 12, padding: 14, color: '#FCA5A5', fontSize: 13 },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#0d141e',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#fff' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { width: '100%', minHeight: 48, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: '#090e16', color: 'var(--text)', fontSize: 14 },
  error: { color: '#FB7185', fontSize: 12 },
  modalActions: { display: 'flex', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, border: '1px solid rgba(148,163,184,.2)', background: 'transparent', color: '#fff' },
  submitBtn: { flex: 1, padding: 12, borderRadius: 12, border: 0, background: '#34D399', color: '#03130D', fontWeight: 900 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeButton: { background: 'none', border: 'none', color: '#38BDF8', fontSize: 14 },
  modalSubtitle: { fontSize: 12, color: '#7F8499', marginTop: 4 },
  history: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  historyRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid rgba(148,163,184,.14)', paddingBottom: 8 },
};
