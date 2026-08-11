import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';

export type PeriodType = 'BUGÜN' | 'HAFTA' | 'AY' | 'YIL';

interface FamilySummaryData {
  total_income: number;
  total_variable_expenses: number;
  total_fixed_expenses: number;
  total_expenses: number;
  net_earnings: number;
  total_miles: number;
  total_hours: number;
  hourly_rate: number;
  per_mile_rate: number;
}

interface VehicleSummaryData {
  vehicle_id: string;
  short_name: string;
  total_income: number;
  total_variable_expenses: number;
  total_fixed_expenses: number;
  total_expenses: number;
  net_profit: number;
  total_miles: number;
  total_hours: number;
  hourly_rate: number;
  per_mile_rate: number;
}

interface DailySummaryData {
  summary_date: string;
  shifts_count: number;
  total_hours: number;
  total_miles: number;
  total_income: number;
  total_variable_expenses: number;
  total_fixed_expenses: number;
  total_expenses: number;
  net_profit: number;
}

interface CardNotificationData {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  days_remaining: number;
  is_paid: boolean;
}

export function HomePage({ familyId }: { familyId: string }) {
  const [period, setPeriod] = useState<PeriodType>('BUGÜN');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [familySummary, setFamilySummary] = useState<FamilySummaryData>({
    total_income: 0,
    total_variable_expenses: 0,
    total_fixed_expenses: 0,
    total_expenses: 0,
    net_earnings: 0,
    total_miles: 0,
    total_hours: 0,
    hourly_rate: 0,
    per_mile_rate: 0,
  });
  const [vehicleSummaries, setVehicleSummaries] = useState<VehicleSummaryData[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailySummaryData[]>([]);
  const [notification, setNotification] = useState<CardNotificationData | null>(null);
  const [payingNotification, setPayingNotification] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Family Summary RPC
      const { data: famData, error: famErr } = await supabase.rpc(
        'get_family_doordash_summary_by_period',
        { p_family_id: familyId, p_period: period }
      );
      if (famErr) {
        console.warn('Family summary RPC error, using fallback:', famErr.message);
      }
      if (famData && Array.isArray(famData) && famData.length > 0) {
        setFamilySummary(famData[0] as FamilySummaryData);
      } else {
        setFamilySummary({
          total_income: 0,
          total_variable_expenses: 0,
          total_fixed_expenses: 0,
          total_expenses: 0,
          net_earnings: 0,
          total_miles: 0,
          total_hours: 0,
          hourly_rate: 0,
          per_mile_rate: 0,
        });
      }

      // 2. Vehicle Summary RPC
      const { data: vehData, error: vehErr } = await supabase.rpc(
        'get_vehicle_doordash_summary_by_period',
        { p_family_id: familyId, p_period: period }
      );
      if (vehErr) {
        console.warn('Vehicle summary RPC error, using fallback:', vehErr.message);
      }
      setVehicleSummaries(Array.isArray(vehData) ? (vehData as VehicleSummaryData[]) : []);

      // 3. Daily Summary RPC
      const { data: dailyData, error: dailyErr } = await supabase.rpc(
        'get_family_daily_summary_by_period',
        { p_family_id: familyId, p_period: period }
      );
      if (dailyErr) {
        console.warn('Daily summary RPC error, using fallback:', dailyErr.message);
      }
      setDailySummaries(Array.isArray(dailyData) ? (dailyData as DailySummaryData[]) : []);

      // 4. Notifications Query
      const { data: notifData, error: notifErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('family_id', familyId)
        .eq('is_paid', false)
        .in('category', ['credit_card', 'kredi_karti'])
        .order('due_date', { ascending: true })
        .limit(1);

      if (!notifErr && notifData && notifData.length > 0) {
        setNotification(notifData[0] as CardNotificationData);
      } else {
        setNotification(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Bilinmeyen bir hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  }, [familyId, period]);

  useEffect(() => {
    fetchData();

    const handleRealtimeChange = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        fetchData();
      }, 500);
    };

    const channel = supabase
      .channel('home-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mileage_log' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_expenses' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, handleRealtimeChange)
      .subscribe();

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleMarkAsPaid = async (notificationId: string) => {
    try {
      setPayingNotification(true);
      const { error: rpcErr } = await supabase.rpc('mark_notification_as_paid', {
        p_notification_id: notificationId,
        p_family_id: familyId,
      });
      if (rpcErr) throw rpcErr;
      setNotification((prev) => (prev ? { ...prev, is_paid: true } : null));
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert('Ödeme işaretlenirken hata oluştu: ' + err.message);
      }
    } finally {
      setPayingNotification(false);
    }
  };

  if (loading && !familySummary) return <LoadingScreen label="Veriler veritabanından yükleniyor..." />;
  if (error) return <ErrorScreen message={error} onRetry={fetchData} />;

  const netEarnings = familySummary?.net_earnings ?? 0;
  const netColor = netEarnings >= 0 ? '#22C55E' : '#F87171';

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logoArea}>
          <span style={styles.logoText}>Family Finance & DoorDash</span>
        </div>
        <div style={styles.dateBellArea}>
          <span style={styles.dateText}>{new Date().toLocaleDateString('tr-TR')}</span>
          <div style={styles.bellWrapper}>
            🔔{notification && <span style={styles.badgeDot} />}
          </div>
        </div>
      </header>

      <div style={styles.heroCard}>
        <span style={styles.heroLabel}>NET KÂR ({period})</span>
        <h1 style={{ ...styles.heroValue, color: netColor }}>
          {netEarnings >= 0 ? '+' : ''}${Math.abs(netEarnings).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </h1>
        <div style={styles.heroSubGrid}>
          <div>
            <span style={styles.subSubLabel}>GELİR</span>
            <p style={styles.subSubVal}>${(familySummary?.total_income ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span style={styles.subSubLabel}>GİDER</span>
            <p style={{ ...styles.subSubVal, color: '#F87171' }}>
              -${Math.abs(familySummary?.total_expenses ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div style={styles.metricsRow}>
          <span>⚡ ${(familySummary?.hourly_rate ?? 0).toFixed(2)} / saat</span>
          <span>🚗 ${(familySummary?.per_mile_rate ?? 0).toFixed(2)} / mil</span>
          <span>🛣️ {(familySummary?.total_miles ?? 0).toLocaleString()} mil</span>
        </div>
      </div>

      <div style={styles.actionButtonsRow}>
        <button style={styles.actionBtnGreen} onClick={() => alert('Gelir Ekle modalı açılacak')}>
          + GELİR EKLE
        </button>
        <button style={styles.actionBtnRed} onClick={() => alert('Gider Ekle modalı açılacak')}>
          + GİDER EKLE
        </button>
      </div>

      <div style={styles.segmented}>
        {(['BUGÜN', 'HAFTA', 'AY', 'YIL'] as PeriodType[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              ...styles.segmentButton,
              background: period === p ? '#22C55E' : 'transparent',
              color: period === p ? '#0B1120' : '#94A3B8',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>ARAÇ PERFORMANSI</h2>
        {vehicleSummaries.length === 0 ? (
          <p style={styles.emptyText}>Bu dönemde kayıtlı aktif araç verisi yok.</p>
        ) : (
          vehicleSummaries.map((v) => (
            <div key={v.vehicle_id} style={styles.vehicleCard}>
              <div style={styles.vehicleHeader}>
                <strong>{v.short_name}</strong>
                <span style={{ color: (v.net_profit ?? 0) >= 0 ? '#22C55E' : '#F87171' }}>
                  ${(v.net_profit ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={styles.vehicleDetails}>
                <span>Gelir: ${(v.total_income ?? 0).toFixed(2)}</span>
                <span>Gider: ${(v.total_expenses ?? 0).toFixed(2)}</span>
                <span>Saat: ${(v.hourly_rate ?? 0).toFixed(2)}/sa</span>
                <span>Mil: ${(v.per_mile_rate ?? 0).toFixed(2)}/mil</span>
              </div>
            </div>
          ))
        )}
      </section>

      {notification && !notification.is_paid && (
        <div style={styles.alertCard}>
          <div>
            <span style={styles.alertBadge}>KREDİ KARTI ÖDEMESİ</span>
            <h3 style={styles.alertTitle}>{notification.title}</h3>
            <p style={styles.alertDesc}>
              Tutar: <strong>${(notification.amount ?? 0).toFixed(2)}</strong> | Kalan Süre: <strong>{notification.days_remaining} gün</strong>
            </p>
          </div>
          <button
            style={styles.payBtn}
            disabled={payingNotification}
            onClick={() => handleMarkAsPaid(notification.id)}
          >
            {payingNotification ? 'İşleniyor...' : '✓ ÖDEMEYİ İŞARETLE'}
          </button>
        </div>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>GÜNLÜK PERFORMANS</h2>
        {dailySummaries.length === 0 ? (
          <p style={styles.emptyText}>Bu dönemde günlük işlem kaydı bulunmuyor.</p>
        ) : (
          <div style={styles.tableWrapper}>
            {dailySummaries.map((d, index) => (
              <div key={index} style={styles.dailyRow}>
                <div>
                  <span style={styles.dailyDate}>{d.summary_date}</span>
                  <span style={styles.dailySub}>{d.shifts_count} vardiya | {d.total_hours} saat | {d.total_miles} mil</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: (d.net_profit ?? 0) >= 0 ? '#22C55E' : '#F87171', fontWeight: 'bold' }}>
                    ${(d.net_profit ?? 0).toFixed(2)}
                  </span>
                  <span style={styles.dailySub}>Gelir: ${(d.total_income ?? 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={styles.tickerCard}>
        <span>USD —</span>
        <span>|</span>
        <span>GOLD —</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '16px 16px 96px', color: '#F8FAFC', background: '#090D16', minHeight: '100vh', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logoText: { fontSize: 14, fontWeight: 700, color: '#38BDF8', letterSpacing: 0.5 },
  dateBellArea: { display: 'flex', alignItems: 'center', gap: 12 },
  dateText: { fontSize: 12, color: '#94A3B8' },
  bellWrapper: { position: 'relative', fontSize: 18, cursor: 'pointer' },
  badgeDot: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, background: '#22C55E', borderRadius: '50%' },
  heroCard: { background: '#111827', border: '1px solid #1F2937', borderRadius: 20, padding: 20, textAlign: 'center', marginBottom: 16 },
  heroLabel: { fontSize: 11, color: '#94A3B8', fontWeight: 600, letterSpacing: 1 },
  heroValue: { fontSize: 36, fontWeight: 800, margin: '8px 0' },
  heroSubGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, borderTop: '1px solid #1F2937', paddingTop: 12 },
  subSubLabel: { fontSize: 10, color: '#64748B' },
  subSubVal: { fontSize: 16, fontWeight: 700, margin: '2px 0 0 0', color: '#38BDF8' },
  metricsRow: { display: 'flex', justifyContent: 'space-around', marginTop: 14, fontSize: 12, color: '#CBD5E1', borderTop: '1px solid #1F2937', paddingTop: 12 },
  actionButtonsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  actionBtnGreen: { background: '#22C55E', color: '#090D16', border: 'none', borderRadius: 12, padding: '12px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  actionBtnRed: { background: '#EF4444', color: '#FFFFFF', border: 'none', borderRadius: 12, padding: '12px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  segmented: { display: 'flex', background: '#111827', borderRadius: 12, padding: 4, marginBottom: 20, border: '1px solid #1F2937' },
  segmentButton: { flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#94A3B8', marginBottom: 10, letterSpacing: 0.5 },
  emptyText: { fontSize: 12, color: '#64748B', textAlign: 'center', padding: 12 },
  vehicleCard: { background: '#111827', border: '1px solid #1F2937', borderRadius: 14, padding: 14, marginBottom: 10 },
  vehicleHeader: { display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 },
  vehicleDetails: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' },
  alertCard: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 14, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  alertBadge: { fontSize: 9, background: '#EF4444', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 },
  alertTitle: { fontSize: 14, fontWeight: 700, margin: '6px 0 2px 0', color: '#FCA5A5' },
  alertDesc: { fontSize: 11, color: '#CBD5E1', margin: 0 },
  payBtn: { background: '#22C55E', color: '#090D16', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: 11, cursor: 'pointer' },
  tableWrapper: { display: 'flex', flexDirection: 'column', gap: 8 },
  dailyRow: { background: '#111827', border: '1px solid #1F2937', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  dailyDate: { display: 'block', fontSize: 13, fontWeight: 600, color: '#E2E8F0' },
  dailySub: { display: 'block', fontSize: 10, color: '#64748B', marginTop: 2 },
  tickerCard: { background: '#111827', border: '1px solid #1F2937', borderRadius: 12, padding: '10px 16px', display: 'flex', justifyContent: 'center', gap: 25, fontSize: 11, color: '#64748B', marginBottom: 20 },
};
