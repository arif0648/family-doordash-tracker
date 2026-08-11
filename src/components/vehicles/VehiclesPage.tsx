import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import { VehicleCard } from '../home/VehicleCard';
import type { VehicleSummaryData } from '../home/HomePage';

interface VehiclesPageProps {
  familyId: string;
}

export function VehiclesPage({ familyId }: VehiclesPageProps) {
  // Araç özetlerini SQL'den çekeceğiz
  const [vehicleSummaries, setVehicleSummaries] = useState<VehicleSummaryData[]>([]);
  const [loadingRPC, setLoadingRPC] = useState<boolean>(true);
  const [errorRPC, setErrorRPC] = useState<string | null>(null);

  // Modal ve Form State'leri
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [shortName, setShortName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Detaylı işlem geçmişi (Modal içi) için realtime hook'u kullanıyoruz
  const {
    vehicles,
    income,
    expenses,
    mileageLog,
    retry
  } = useFamilyRealtimeData(familyId);

  const fetchVehicleSummaries = useCallback(async () => {
    if (!familyId) return;
    try {
      setLoadingRPC(true);
      setErrorRPC(null);

      // 'AY' (Aylık) periyoduna göre araç raporlarını getir
      const { data, error } = await supabase.rpc('get_vehicle_doordash_summary_by_period', {
        p_family_id: familyId,
        p_period: 'AY',
      });

      if (error) throw error;

      // Gelen veriyi tam tipli hale getir
      const parsed: VehicleSummaryData[] = (data || []).map((v: any) => ({
        vehicle_id: v.vehicle_id,
        full_name: v.full_name,
        short_name: v.short_name,
        total_income: Number(v.total_income || 0),
        total_variable_expenses: Number(v.total_variable_expenses || 0),
        total_fixed_expenses: Number(v.total_fixed_expenses || 0),
        total_expenses: Number(v.total_expenses || 0),
        net_earnings: Number(v.net_earnings || 0),
        total_miles: Number(v.total_miles || 0),
        total_hours: Number(v.total_hours || 0),
        hourly_rate: Number(v.hourly_rate || 0),
        per_mile_rate: Number(v.per_mile_rate || 0)
      }));

      setVehicleSummaries(parsed);
    } catch (err: any) {
      console.error('Araç özetleri yüklenirken hata:', err);
      setErrorRPC(err?.message || 'Araç özetleri yüklenemedi.');
    } finally {
      setLoadingRPC(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchVehicleSummaries();
  }, [fetchVehicleSummaries, income, expenses, mileageLog]);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const vehicleName = fullName.trim();
    const vehicleShortName = shortName.trim();

    if (!vehicleName || !vehicleShortName) {
      setFormError('Lütfen tam araç adını ve kısa adını doldurun.');
      return;
    }

    setIsSaving(true);
    try {
      const { error: insertError } = await supabase
        .from('vehicles')
        .insert({
          family_id: familyId,
          full_name: vehicleName,
          short_name: vehicleShortName,
        });

      if (insertError) throw insertError;

      setFullName('');
      setShortName('');
      setFormError(null);
      setIsAddModalOpen(false);
      // Realtime hook veriyi otomatik güncelleyecek, fetchVehicleSummaries tetiklenecek.
    } catch (err: any) {
      console.error('Araç ekleme hatası:', err);
      setFormError(`Kayıt başarısız: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingRPC) return <LoadingScreen label="Araç istatistikleri hesaplanıyor..." />;
  if (errorRPC) return <ErrorScreen message={errorRPC} onRetry={fetchVehicleSummaries} />;

  const selectedVehicle = vehicles?.find((v) => v.id === selectedVehicleId) ?? null;

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <h1 style={styles.heading}>🚗 Araç Performansı <span style={styles.periodBadge}>(Bu Ay)</span></h1>
        <button
          type="button"
          style={styles.addButton}
          onClick={() => { setFormError(null); setIsAddModalOpen(true); }}
          disabled={isSaving}
        >
          + Araç Ekle
        </button>
      </div>

      {(!vehicleSummaries || vehicleSummaries.length === 0) ? (
        <div style={styles.emptyContainer}>
          <EmptyState message="Bu ay için araç istatistiği bulunamadı" icon="🚗" />
          <button
            type="button"
            style={styles.firstAddButton}
            onClick={() => setIsAddModalOpen(true)}
          >
            + İlk Aracı Ekle
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {vehicleSummaries.map((vs) => (
            <button
              key={vs.vehicle_id}
              type="button"
              style={styles.cardButton}
              onClick={() => setSelectedVehicleId(vs.vehicle_id)}
            >
              <div style={styles.vehicleHeaderRow}>
                <span style={styles.vehicleShortBadge}>{vs.short_name || 'ARAÇ'}</span>
                <span style={styles.vehicleFullTitle}>{vs.full_name || 'Araç Modeli'}</span>
                <span style={styles.statusPill}>
                  {vs.net_earnings >= 0 ? 'KÂRDA' : 'ZARARDA'}
                </span>
              </div>
              <VehicleCard
                shortName={vs.short_name}
                summary={{
                  totalIncome: vs.total_income,
                  variableExpenses: vs.total_variable_expenses,
                  fixedExpenseShare: vs.total_fixed_expenses,
                  totalExpenses: vs.total_expenses,
                  netEarnings: vs.net_earnings,
                  hourlyRate: vs.hourly_rate,
                  perMileRate: vs.per_mile_rate,
                  totalMiles: vs.total_miles,
                }}
                showFixedShare
              />
            </button>
          ))}
        </div>
      )}

      {}
      {selectedVehicle && (
        <VehicleDetailModal
          vehicleName={selectedVehicle.short_name}
          income={income?.filter((r) => r.vehicle_id === selectedVehicle.id) || []}
          expenses={expenses?.filter((r) => r.vehicle_id === selectedVehicle.id) || []}
          onClose={() => setSelectedVehicleId(null)}
        />
      )}

      {isAddModalOpen && (
        <div style={styles.modalOverlay} onClick={() => { if (!isSaving) setIsAddModalOpen(false); }}>
          <div style={styles.addModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>🚗 Araç Ekle</h2>
              <button type="button" style={styles.closeButton} onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>Kapat</button>
            </div>
            {formError && <div style={styles.errorBox}>{formError}</div>}
            <form onSubmit={handleAddVehicle} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Tam Araç Adı / Model *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Örn: 2026 Kia Sportage"
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
                <button type="button" disabled={isSaving} onClick={() => setIsAddModalOpen(false)} style={styles.cancelButton}>İptal</button>
                <button type="submit" disabled={isSaving} style={styles.submitButton}>{isSaving ? 'Kaydediliyor...' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function VehicleDetailModal({ vehicleName, income, expenses, onClose }: { vehicleName: string; income: any[]; expenses: any[]; onClose: () => void; }) {
  const combined = [
    ...income.map((r) => ({ type: 'Kazanç', date: r.record_date, amount: r.amount })),
    ...expenses.map((r) => ({ type: r.category || 'Gider', date: r.record_date, amount: -r.amount })),
  ].sort((a, b) => (new Date(a.date) < new Date(b.date) ? 1 : -1));

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{vehicleName} Geçmişi</h2>
          <button type="button" style={styles.closeButton} onClick={onClose}>Kapat</button>
        </div>
        {combined.length === 0 ? (
          <EmptyState message="Bu araç için detaylı işlem kaydı yok." />
        ) : (
          <div style={styles.history}>
            {combined.map((item, index) => (
              <div key={`${item.date}-${index}`} style={styles.historyRow}>
                <span style={styles.historyType}>{item.type}</span>
                <span style={styles.historyDate}>{new Date(item.date).toLocaleDateString('tr-TR')}</span>
                <span style={{ ...styles.historyAmount, color: item.amount >= 0 ? '#00E676' : '#F87171' }}>
                  {item.amount >= 0 ? '+' : ''}{Number(item.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
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
  page: { padding: '16px 16px 96px', color: '#F8FAFC', maxWidth: 600, margin: '0 auto' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heading: { fontSize: 20, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
  periodBadge: { fontSize: 12, fontWeight: 600, color: '#38BDF8', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: 6 },
  addButton: { background: '#00E676', color: '#000', border: 'none', borderRadius: 12, padding: '10px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,230,118,0.2)' },
  emptyContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: '#0F172A', padding: 30, borderRadius: 16, border: '1px solid #1E293B', marginTop: 20 },
  firstAddButton: { background: '#1E293B', color: '#00E676', border: '1px solid #334155', borderRadius: 12, padding: '12px 20px', fontWeight: 800, fontSize: 13, cursor: 'pointer' },
  list: { display: 'flex', flexDirection: 'column', gap: 16 },
  cardButton: { background: '#0F172A', border: '1px solid #1E293B', borderRadius: 16, padding: 16, textAlign: 'left', width: '100%', cursor: 'pointer', display: 'flex', flexDirection: 'column' },
  vehicleHeaderRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  vehicleShortBadge: { background: '#00E676', color: '#000', fontWeight: 900, fontSize: 11, padding: '3px 8px', borderRadius: 6 },
  vehicleFullTitle: { fontSize: 15, fontWeight: 700, color: '#F8FAFC', flex: 1 },
  statusPill: { background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999, padding: 0 },
  addModal: { background: '#0F172A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, width: '100%', maxWidth: 600, borderTop: '1px solid #1E293B' },
  detailModal: { background: '#0F172A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', borderTop: '1px solid #1E293B' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 800, margin: 0 },
  closeButton: { background: '#1E293B', border: 'none', color: '#F8FAFC', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '8px 16px', borderRadius: 8 },
  history: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 },
  historyRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0B132B', padding: '12px 16px', borderRadius: 12, border: '1px solid #1E293B' },
  historyType: { fontSize: 13, fontWeight: 700, color: '#94A3B8', flex: 1 },
  historyDate: { fontSize: 12, color: '#64748B', flex: 1, textAlign: 'center' },
  historyAmount: { fontSize: 14, fontWeight: 800, flex: 1, textAlign: 'right' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px' },
  input: { background: '#0B132B', border: '1px solid #1E293B', borderRadius: 10, padding: '14px', color: '#F8FAFC', fontSize: 15, outline: 'none' },
  formActions: { display: 'flex', gap: 12, marginTop: 10 },
  cancelButton: { flex: 1, background: 'transparent', border: '1px solid #334155', color: '#94A3B8', borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  submitButton: { flex: 1, background: '#00E676', border: 'none', color: '#000', borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
  errorBox: { background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#FCA5A5', padding: '12px', borderRadius: 10, fontSize: 13, marginBottom: 16, fontWeight: 600 },
};
