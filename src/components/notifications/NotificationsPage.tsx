import React, { useMemo, useState } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import { supabase } from '../../lib/supabaseClient';
import { NotificationRow, NotificationType, CreditCardRow } from '../../types/database';
import { NavLink } from 'react-router';

type Tab = 'all' | 'notifications' | 'payments' | 'appointments';

const TYPE_ICONS: Record<NotificationType, string> = {
  CREDIT_CARD: '▭',
  PAYMENT: '$',
  APPOINTMENT: '□',
  VEHICLE: '◇',
  FINANCIAL: '▥',
  SYSTEM: '◎',
};

const TYPE_COLORS: Record<NotificationType, string> = {
  CREDIT_CARD: '#E8BD58',
  PAYMENT: '#34D399',
  APPOINTMENT: '#60A5FA',
  VEHICLE: '#F59E0B',
  FINANCIAL: '#EC4899',
  SYSTEM: '#9CA3AF',
};

const TYPE_LABELS: Record<NotificationType, string> = {
  CREDIT_CARD: 'KART',
  PAYMENT: 'ÖDEME',
  APPOINTMENT: 'RANDEVU',
  VEHICLE: 'ARAÇ',
  FINANCIAL: 'FİNANS',
  SYSTEM: 'SİSTEM',
};

export function NotificationsPage({ familyId }: { familyId: string }) {
  const { notifications, creditCards, appointments, loading, error, retry } = useFamilyRealtimeData(familyId);
  const [markingAll, setMarkingAll] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');

  const { pastDues, dues } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueList: CreditCardRow[] = [];
    const pastList: CreditCardRow[] = [];
    for (const c of creditCards) {
      if (!c.due_date) continue;
      const t = new Date(`${c.due_date}T00:00:00`).getTime();
      const days = Math.round((t - today.getTime()) / 86400000);
      if (days < 0) pastList.push(c);
      else if (days <= 7) dueList.push(c);
    }
    return { dues: dueList, pastDues: pastList };
  }, [creditCards]);

  const upcomingAppointments = useMemo(() => {
    const today = new Date(new Date().toDateString()).getTime();
    return appointments
      .filter((a) => {
        const t = new Date(a.start_at).getTime();
        const days = Math.round((t - today) / 86400000);
        return a.status !== 'cancelled' && days >= 0 && days <= 7;
      })
      .slice(0, 8);
  }, [appointments]);

  if (loading) return <LoadingScreen label="Bildirimler yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  const unread = notifications.filter((n) => !n.read_at);
  const read = notifications.filter((n) => n.read_at);

  async function handleMarkRead(notification: NotificationRow) {
    const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: notification.id });
    if (error) {
      setFormError(error.message);
      return;
    }
    retry();
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    const { error } = await supabase.rpc('mark_all_notifications_read');
    setMarkingAll(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    retry();
  }

  const showNotifications = tab === 'all' || tab === 'notifications';
  const showPayments = tab === 'all' || tab === 'payments';
  const showAppointments = tab === 'all' || tab === 'appointments';
  const hasPayment = pastDues.length > 0 || dues.length > 0;
  const hasAppointments = upcomingAppointments.length > 0;

  const empty = notifications.length === 0 && !hasPayment && !hasAppointments;

  return (
    <main className="app-page" style={S.page}>
      <header style={S.header}>
        <div>
          <span style={S.kicker}>BİLDİRİMLER</span>
          <h1 style={S.h1}>Merkez</h1>
          <p style={S.sub}>
            {unread.length > 0 ? `${unread.length} okunmamış bildirim` : 'Okunmamış bildirim yok'}
          </p>
        </div>
        <NavLink to="/profil" style={S.settingsLink}>Ayarlar ›</NavLink>
      </header>

      {formError && <div style={S.error}>{formError}</div>}

      <div style={S.tabs}>
        {([
          { key: 'all', label: 'Hepsi' },
          { key: 'notifications', label: 'Bildirimler' },
          { key: 'payments', label: 'Ödemeler' },
          { key: 'appointments', label: 'Randevular' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...S.tab, ...(tab === t.key ? S.tabActive : {}) }}
          >
            {t.label}
            {t.key === 'notifications' && unread.length > 0 && <span style={S.badgeDot}>{unread.length}</span>}
            {t.key === 'payments' && hasPayment && (pastDues.length > 0 ? <span style={{ ...S.badgeDot, background: '#DC2626' }}>{pastDues.length}</span> : null)}
          </button>
        ))}
      </div>

      {unread.length > 0 && tab !== 'appointments' && tab !== 'payments' && (
        <button onClick={handleMarkAllRead} style={S.markAll} disabled={markingAll}>
          {markingAll ? 'İşleniyor…' : 'Tümünü Okundu İşaretle'}
        </button>
      )}

      {empty ? (
        <EmptyState message="Henüz bildirim yok." icon="○" />
      ) : (
        <>
          {showNotifications && (
            <section style={S.section}>
              {unread.length > 0 && <h3 style={S.sectionTitle}>OKUNMAMIŞ</h3>}
              {unread.map((n) => (
                <NotificationCard key={n.id} notification={n} onMarkRead={handleMarkRead} />
              ))}
              {read.length > 0 && <h3 style={{ ...S.sectionTitle, marginTop: 16 }}>OKUNAN</h3>}
              {read.map((n) => (
                <NotificationCard key={n.id} notification={n} onMarkRead={handleMarkRead} />
              ))}
              {notifications.length === 0 && tab === 'notifications' && <EmptyState message="Henüz bildirim yok." icon="○" />}
            </section>
          )}

          {showPayments && hasPayment && (
            <section style={S.section}>
              <h3 style={S.sectionTitle}>YAKLAŞAN ÖDEMELER</h3>
              {pastDues.map((c) => (
                <PaymentCard key={c.id} card={c} overdue />
              ))}
              {dues.map((c) => (
                <PaymentCard key={c.id} card={c} overdue={false} />
              ))}
            </section>
          )}

          {showAppointments && hasAppointments && (
            <section style={S.section}>
              <h3 style={S.sectionTitle}>YAKLAŞAN RANDEVULAR</h3>
              {upcomingAppointments.map((a) => (
                <AppointmentCard key={a.id} appointment={a} />
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}

function PaymentCard({ card, overdue }: { card: CreditCardRow; overdue: boolean }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = card.due_date ? Math.round((new Date(`${card.due_date}T00:00:00`).getTime() - today.getTime()) / 86400000) : null;
  const amount = Number(card.current_balance || 0);
  return (
    <NavLink
      to="/kredi-kartlari"
      style={{
        ...S.alert,
        borderColor: overdue ? 'rgba(251,113,133,.35)' : 'var(--border)',
        background: overdue ? 'rgba(251,113,133,.07)' : '#101823',
      }}
    >
      <div style={{ ...S.alertIcon, background: overdue ? 'rgba(240,111,127,.12)' : 'rgba(232,189,88,.09)', color: overdue ? '#F5A0AA' : '#E8BD58' }}>▭</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.alertTitle}>{card.card_name}</div>
        <div style={S.alertMeta}>
          {overdue ? `${Math.abs(days ?? 0)} gün gecikmiş` : days === 0 ? 'Bugün ödeme' : `${days} gün kaldı`}
        </div>
      </div>
      <div style={{ ...S.alertAmount, color: overdue ? '#FDA4AF' : '#fff' }}>${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      <span style={S.goArrow}>›</span>
    </NavLink>
  );
}

function AppointmentCard({ appointment: a }: { appointment: { id: string; title: string; start_at: string } }) {
  const today = new Date(new Date().toDateString()).getTime();
  const days = Math.round((new Date(a.start_at).getTime() - today) / 86400000);
  const dateStr = new Date(a.start_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const timeStr = new Date(a.start_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return (
    <NavLink to="/randevular" style={S.alert}>
      <div style={{ ...S.alertIcon, background: 'rgba(60,200,237,.09)', color: 'var(--accent)' }}>□</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.alertTitle}>{a.title}</div>
        <div style={S.alertMeta}>{days === 0 ? 'Bugün' : `${days} gün sonra`} • {dateStr} {timeStr}</div>
      </div>
      <span style={S.goArrow}>›</span>
    </NavLink>
  );
}

function NotificationCard({ notification, onMarkRead }: { notification: NotificationRow; onMarkRead: (n: NotificationRow) => void }) {
  const icon = TYPE_ICONS[notification.type] || '○';
  const color = TYPE_COLORS[notification.type] || '#9CA3AF';
  const label = TYPE_LABELS[notification.type] || notification.type;
  const dateStr = new Date(notification.created_at).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article style={{ ...S.card, opacity: notification.read_at ? 0.55 : 1 }}>
      <div style={{ ...S.icon, background: `${color}18`, color }}>{icon}</div>
      <div style={S.content}>
        <div style={S.cardHead}>
          <span style={{ ...S.typeBadge, color, background: `${color}18` }}>{label}</span>
          <span style={S.date}>{dateStr}</span>
        </div>
        <h4 style={S.cardTitle}>{notification.title}</h4>
        {notification.body && <p style={S.cardBody}>{notification.body}</p>}
      </div>
      {!notification.read_at && (
        <button onClick={() => onMarkRead(notification)} style={S.markRead}>✓</button>
      )}
    </article>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '16px 14px var(--page-bottom-space)', color: 'var(--text)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  kicker: { fontSize: 9, letterSpacing: 1.5, color: 'var(--muted)', fontWeight: 750 },
  h1: { fontSize: 26, margin: '5px 0 3px' },
  sub: { fontSize: 12, color: '#7F8499', margin: 0 },
  settingsLink: { fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 },
  error: { marginTop: 14, padding: 12, borderRadius: 14, background: 'rgba(251,113,133,.1)', border: '1px solid rgba(251,113,133,.2)', color: '#FDA4AF', fontSize: 12 },
  tabs: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, padding: 4, borderRadius: 15, background: '#0e151f', border: '1px solid var(--border)', marginBottom: 14 },
  tab: { position: 'relative', padding: '10px 4px', textAlign: 'center', borderRadius: 12, border: 0, background: 'transparent', color: '#898DA0', fontSize: 11, fontWeight: 800, cursor: 'pointer' },
  tabActive: { background: 'rgba(60,200,237,.09)', boxShadow: 'inset 0 0 0 1px rgba(60,200,237,.18)', color: 'var(--text)' },
  badgeDot: { position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--negative)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px' },
  markAll: { width: '100%', padding: 11, borderRadius: 13, border: '1px solid var(--border)', background: 'rgba(255,255,255,.035)', color: 'var(--text-secondary)', fontWeight: 750, fontSize: 13, marginBottom: 14 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 10, color: '#7F8499', marginBottom: 10, fontWeight: 900, letterSpacing: 1 },
  card: { display: 'flex', gap: 11, alignItems: 'center', padding: 13, borderRadius: 15, background: '#101823', border: '1px solid var(--border)', marginBottom: 7, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.025)' },
  icon: { width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  content: { flex: 1, minWidth: 0 },
  cardHead: { display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5, alignItems: 'center' },
  typeBadge: { fontSize: 9, padding: '4px 8px', borderRadius: 8, fontWeight: 900, letterSpacing: .6 },
  date: { fontSize: 11, color: '#6F748A' },
  cardTitle: { fontSize: 15, margin: '0 0 4px', color: '#fff', fontWeight: 800 },
  cardBody: { fontSize: 13, color: '#7F8499', margin: 0 },
  markRead: { width: 34, height: 34, borderRadius: 10, border: 0, background: 'rgba(52,211,153,.15)', color: '#34D399', fontWeight: 900, fontSize: 14, flexShrink: 0, cursor: 'pointer' },
  alert: { display: 'flex', alignItems: 'center', gap: 11, padding: 13, borderRadius: 15, background: '#101823', border: '1px solid', marginBottom: 7, textDecoration: 'none', color: 'var(--text)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.025)' },
  alertIcon: { width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  alertTitle: { fontSize: 14, fontWeight: 800, color: '#fff' },
  alertMeta: { fontSize: 12, color: '#7F8499', marginTop: 2 },
  alertAmount: { fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap' },
  goArrow: { color: 'var(--accent)', fontSize: 20, marginLeft: 4 },
};
