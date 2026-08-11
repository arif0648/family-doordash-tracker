import React, { useMemo, useState } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import {
  LoadingScreen,
  ErrorScreen,
  EmptyState,
} from '../common/StateScreens';
import {
  computeVehicleSummary,
  IncomeRecord,
  ExpenseRecord,
  FixedExpenseVersion,
} from '../../lib/financialEngine';
import {
  monthBoundary,
  toPacificDateString,
} from '../../lib/timezone';
import {
  sumMilesInPeriod,
  MileageEntry,
} from '../../lib/mileageEngine';
import { VehicleCard } from '../home/VehicleCard';
import { supabase } from '../../lib/supabase';

interface VehiclesPageProps {
  familyId: string;
}

export function VehiclesPage({ familyId }: VehiclesPageProps) {
  const {
    vehicles,
    income,
    expenses,
    mileageLog,
    fixedExpenses,
    loading,
    error,
    retry,
  } = useFamilyRealtimeData(familyId);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Araç ekleme modalı state'leri
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [shortName, setShortName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const now = new Date();
  const boundary = useMemo(() => monthBoundary(now), []);
  const monthAnchor = toPacificDateString(now);

  if (loading) return <LoadingScreen label="Araçlar yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  // Verileri financial engine formatına map etme
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
    milesDriven: m.miles_driven ?? m.miles ?? 0,
  }));

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const vehicleName = fullName.trim();
    const vehicleShortName = shortName.trim();

    if (!vehicleName || !vehicleShortName) {
      setFormError('Lütfen tam araç adını ve kısa adını doldurun.');
      return;
    }

    if (!familyId) {
      setFormError('Aile kimliği (familyId) bulunamadı. Lütfen oturumunuzu yenileyin.');
      return;
    }

    setIsSaving(true);

    try {
      // Supabase'e güvenli INSERT (RSL policy: is_family_member(family_id) denetiminden geçer)
      const { error: insertError } = await supabase
        .from('vehicles')
        .insert({
          family_id: familyId,
          full_name: vehicleName,
          short_name: vehicleShortName,
        });

      if (insertError) throw insertError;

      // Başarılı kayıt sonrası form temizliği ve modal kapanışı
      setFullName('');
      setShortName('');
      setFormError(null);
      setIsAddModalOpen(false);

    } catch (err: any) {
      console.error('Araç ekleme hatası:', err);
      const errorCode = err?.code;
      const errorMessage = err?.message || '';

      if (
        errorCode === '42501' ||
        errorMessage.toLowerCase().includes('permission denied') ||
        errorMessage.toLowerCase().includes('row-level security')
      ) {
        setFormError('Güvenlik Hatası (RLS): Bu aileye araç ekleme yetkiniz yok veya is_family_member doğrulaması başarısız oldu.');
      } else {
        setFormError(`Araç eklenirken hata oluştu: ${errorMessage || 'Lütfen tekrar deneyin.'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const selectedVehicle = vehicles?.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;

  return (
    <div style={styles.page}>

      {/* ÜST BAŞLIK VE DOKUNMATİK EKLE BUTONU */}
      <div style={styles.headerRow}>
        <h1 style={styles.heading}>🚗 Araçlar</h1>
        <button
          type="button"
          style={styles.addButton}
          onClick={() => {
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          disabled={isSaving}
        >
          + Araç Ekle
        </button>
      </div>

      {/* ARAÇ LİSTESİ VEYA BOŞ DURUM */}
      {!vehicles || vehicles.length === 0 ? (
        <div style={styles.emptyContainer}>
          <EmptyState message="Henüz araç tanımlanmamış" icon="🚗" />
          <button
            type="button"
            style={styles.firstAddButton}
            onClick={() => {
              setFormError(null);
              setIsAddModalOpen(true);
            }}
          >
            + İlk Aracı Ekle
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {vehicles.map((vehicle) => {
            try {
              const vehicleMiles = mileageEntries.filter((m) => m.vehicleId === vehicle.id);
              const summary = computeVehicleSummary({
                vehicle: { id: vehicle.id, shortName: vehicle.short_name },
                period: 'month',
                boundary,
                income: incomeRecords,
                expenses: expenseRecords,
                fixedExpenseVersions: fixedVersions,
                monthAnchorDate: monthAnchor,
                totalVehicleCount: vehicles.length,
                milesInPeriod: sumMilesInPeriod(vehicleMiles, boundary.start, boundary.end),
              });

              return (
                <button
                  key={vehicle.id}
                  type="button"
                  style={styles.cardButton}
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                >
                  <VehicleCard
                    shortName={vehicle.short_name}
                    summary={summary}
                    showFixedShare
                  />
                </button>
              );
            } catch (calcError) {
              return (
                <div key={vehicle.id} style={styles.cardError}>
                  {vehicle.short_name}: Hesaplama hatası ({(calcError as Error).message})
                </div>
              );
            }
          })}
        </div>
      )}

      {/* ARAÇ DETAY MODALI */}
      {selectedVehicle && (
        <VehicleDetailModal
          vehicleName={selectedVehicle.short_name}
          income={incomeRecords.filter((r) => r.vehicleId === selectedVehicle.id)}
          expenses={expenseRecords.filter((r) => r.vehicleId === selectedVehicle.id)}
          mileageEntries={mileageEntries.filter((m) => m.vehicleId === selectedVehicle.id)}
          onClose={() => setSelectedVehicleId(null)}
        />
      )}

      {/* ARAÇ EKLEME MODALI */}
      {isAddModalOpen && (
        <div
          style={styles.modalOverlay}
          onClick={() => { if (!isSaving) setIsAddModalOpen(false); }}
        >
          <div style={styles.addModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>🚗 Araç Ekle</h2>
              <button
                type="button"
                style={styles.closeButton}
                onClick={() => { if (!isSaving) setIsAddModalOpen(false); }}
                disabled={isSaving}
              >
                Kapat
              </button>
            </div>

            {formError && <div style={styles.errorBox}>{formError}</div>}

            <form onSubmit={handleAddVehicle} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Tam Araç Adı / Model *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Örn: 2026 Kia Sportage Hybrid"
                  disabled={isSaving}
                  style={styles.input}
                  autoFocus
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Kısa Ad / Kod *</label>
                <input
                  type="text"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder="Örn: KIA"
                  disabled={isSaving}
                  style={styles.input}
                />
              </div>

              <div style={styles.formActions}>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsAddModalOpen(false)}
                  style={styles.cancelButton}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    ...styles.submitButton,
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  mileageEntries: MileageEntry[];
  onClose: () => void;
}) {
  const combined = [
    ...income.map((r) => ({ type: 'Kazanç', date: r.recordDate, amount: r.amount })),
    ...expenses.map((r) => ({ type: r.category, date: r.recordDate, amount: -r.amount })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalMiles = mileageEntries.reduce((sum, m) => sum + (Number(m.milesDriven) || 0), 0);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{vehicleName}</h2>
          <button type="button" style={styles.closeButton} onClick={onClose}>Geri</button>
        </div>

        <p style={styles.modalSubtitle}>Toplam Mil: {totalMiles} mi</p>

        {combined.length === 0 ? (
          <EmptyState message="Bu araç için henüz kayıt yok" />
        ) : (
          <div style={styles.history}>
            {combined.map((item, index) => (
              <div key={`${item.date}-${item.type}-${index}`} style={styles.historyRow}>
                <span>{item.type}</span>
                <span>{item.date}</span>
                <span style={{ color: item.amount >= 0 ? '#22C55E' : '#F87171' }}>
                  {item.amount >= 0 ? '+' : ''}
                  {Number(item.amount).toLocaleString('en-US')}$
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
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heading: { fontSize: 20, fontWeight: 700, margin: 0 },
  addButton: { background: '#00E676', color: '#000', border: 'none', borderRadius: 10, padding: '12px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 44 },
  emptyContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, margin: '20px 0' },
  firstAddButton: { background: '#1E293B', color: '#00E676', border: '1px solid #334155', borderRadius: 10, padding: '12px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 44 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  cardButton: { background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' },
  cardError: { background: '#3F1D1D', borderRadius: 12, padding: 14, color: '#FCA5A5', fontSize: 13 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: 0 },
  addModal: { background: '#0F172A', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, width: '100%', maxWidth: 520, boxSizing: 'border-box' },
  detailModal: { background: '#0F172A', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', boxSizing: 'border-box' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 700, margin: 0 },
  closeButton: { background: 'none', border: 'none', color: '#38BDF8', fontSize: 14, cursor: 'pointer', padding: 12, minHeight: 44 },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 4 },
  history: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  historyRow: { display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, fontSize: 13, borderBottom: '1px solid #1E293B', paddingBottom: 8 },
  form: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: '#94A3B8' },
  input: { background: '#1E293B', border: '1px solid #334155', borderRadius: 8, padding: '12px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%', minHeight: 44 },
  formActions: { display: 'flex', gap: 10, marginTop: 8 },
  cancelButton: { flex: 1, background: '#1E293B', border: '1px solid #334155', color: '#CBD5E1', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 },
  submitButton: { flex: 1, background: '#00E676', border: 'none', color: '#000', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  errorBox: { background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', color: '#FCA5A5', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginTop: 12 },
};
