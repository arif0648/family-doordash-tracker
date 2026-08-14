import React, { useState } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import { supabase } from '../../lib/supabaseClient';
import { translateError } from '../../lib/errorMessage';
import { AppointmentRow, AppointmentType, AppointmentStatus } from '../../types/database';

const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: 'vehicle_maintenance', label: 'Araç Bakımı' },
  { value: 'oil_change', label: 'Yağ Değişimi' },
  { value: 'registration', label: 'Ruhsat/Yenileme' },
  { value: 'insurance_renewal', label: 'Sigorta Yenileme' },
  { value: 'school_event', label: 'Okul Etkinliği' },
  { value: 'child_activity', label: 'Çocuk Aktivitesi' },
  { value: 'doctor', label: 'Doktor' },
  { value: 'dentist', label: 'Dişçi' },
  { value: 'family_appointment', label: 'Aile Randevusu' },
  { value: 'personal_reminder', label: 'Kişisel Hatırlatma' },
  { value: 'other', label: 'Diğer' },
];

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  upcoming: '#34D399',
  completed: '#60A5FA',
  cancelled: '#F87171',
};

export function AppointmentsPage({ familyId }: { familyId: string }) {
  const { appointments, loading, error, retry } = useFamilyRealtimeData(familyId);
  const [showForm, setShowForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentRow | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'personal_reminder' as AppointmentType,
    startDate: '',
    startTime: '',
    reminder_days: [1] as number[],
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (loading) return <LoadingScreen label="Randevular yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  const upcoming = appointments.filter(a => a.status === 'upcoming');
  const past = appointments.filter(a => a.status !== 'upcoming');

  const toTimestamp = (date: string, time: string) => {
    const t = time || '00:00';
    if (!date) return null;
    return `${date}T${t}:00`;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formData.title.trim()) {
      setFormError('Başlık zorunludur.');
      return;
    }
    if (!formData.startDate) {
      setFormError('Tarih zorunludur.');
      return;
    }

    setSaving(true);

    try {
      const startAt = toTimestamp(formData.startDate, formData.startTime);

      if (editingAppointment) {
        const { error } = await supabase.rpc('update_appointment', {
          p_appointment_id: editingAppointment.id,
          p_title: formData.title.trim(),
          p_description: formData.description || null,
          p_type: formData.type,
          p_start_at: startAt,
          p_end_at: null,
          p_all_day: false,
          p_reminder_days: formData.reminder_days,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('create_appointment', {
          p_title: formData.title.trim(),
          p_description: formData.description || null,
          p_type: formData.type,
          p_start_at: startAt,
          p_end_at: null,
          p_all_day: false,
          p_reminder_days: formData.reminder_days,
        });
        if (error) throw error;
      }

      setShowForm(false);
      setEditingAppointment(null);
      setFormData({
        title: '',
        description: '',
        type: 'personal_reminder',
        startDate: '',
        startTime: '',
        reminder_days: [1],
      });
      retry();
    } catch (err: any) {
      setFormError(err.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(appointment: AppointmentRow) {
    if (!window.confirm('Bu randevuyu iptal etmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase.rpc('cancel_appointment', { p_appointment_id: appointment.id });
    if (error) {
      setFormError(translateError(error.message));
      return;
    }
    retry();
  }

  async function handleDelete(appointment: AppointmentRow) {
    if (!window.confirm('Bu randevuyu kalıcı olarak silmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase.from('appointments').delete().eq('id', appointment.id);
    if (error) {
      setFormError(translateError(error.message));
      return;
    }
    retry();
  }

  async function handleComplete(appointment: AppointmentRow) {
    const { error } = await supabase.rpc('update_appointment', {
      p_appointment_id: appointment.id,
      p_status: 'completed',
    });
    if (error) {
      setFormError(error.message);
      return;
    }
    retry();
  }

  function openEdit(appointment: AppointmentRow) {
    setEditingAppointment(appointment);
    const date = appointment.start_at.substring(0, 10);
    const time = appointment.start_at.length >= 16 ? appointment.start_at.substring(11, 16) : '';
    setFormData({
      title: appointment.title,
      description: appointment.description || '',
      type: appointment.type,
      startDate: date,
      startTime: time,
      reminder_days: appointment.reminder_days,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingAppointment(null);
    setFormData({
      title: '',
      description: '',
      type: 'personal_reminder',
      startDate: '',
      startTime: '',
      reminder_days: [1],
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const todayAppointments = upcoming.filter(a => a.start_at.startsWith(today));
  const tomorrowAppointments = upcoming.filter(a => a.start_at.startsWith(tomorrow));
  const weekAppointments = upcoming.filter(a => a.start_at >= today && a.start_at <= nextWeek && !a.start_at.startsWith(today) && !a.start_at.startsWith(tomorrow));

  return (
    <main style={S.page}>
      <header>
        <span style={S.kicker}>PLANLAMA</span>
        <h1 style={S.h1}>Randevular</h1>
        <p style={S.sub}>Aile randevuları ve hatırlatıcıları.</p>
      </header>

      {formError && <div style={S.error}>{formError}</div>}

      {showForm ? (
        <div style={S.formContainer}>
          <form onSubmit={handleSubmit} style={S.form}>
            <h2 style={S.formTitle}>{editingAppointment ? 'Randevuyu Düzenle' : 'Yeni Randevu'}</h2>
            
            <label style={S.label}>Başlık</label>
            <input
              style={S.input}
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="Randevu başlığı"
              required
            />

            <label style={S.label}>Tür</label>
            <select
              style={S.input}
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as AppointmentType })}
            >
              {APPOINTMENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <label style={S.label}>Açıklama</label>
            <textarea
              style={S.textarea}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Opsiyonel açıklama"
              rows={3}
            />

            <label style={S.label}>Tarih</label>
            <input
              style={S.input}
              type="date"
              value={formData.startDate}
              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
              required
            />

            <label style={S.label}>Saat</label>
            <input
              style={S.input}
              type="time"
              value={formData.startTime}
              onChange={e => setFormData({ ...formData, startTime: e.target.value })}
            />

            <label style={S.label}>Hatırlatma (gün önce)</label>
            <div style={S.reminderDays}>
              {[7, 3, 1].map(days => (
                <label key={days} style={S.reminderCheckbox}>
                  <input
                    type="checkbox"
                    checked={formData.reminder_days.includes(days)}
                    onChange={e => {
                      if (e.target.checked) {
                        setFormData({ ...formData, reminder_days: [...formData.reminder_days, days] });
                      } else {
                        setFormData({ ...formData, reminder_days: formData.reminder_days.filter(d => d !== days) });
                      }
                    }}
                  />
                  {days} gün
                </label>
              ))}
            </div>

            <div style={S.buttonRow}>
              <button type="button" onClick={closeForm} style={S.cancelButton} disabled={saving}>İptal</button>
              <button type="submit" style={S.saveButton} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <button onClick={() => setShowForm(true)} style={S.addButton}>+ Yeni Randevu</button>

          {upcoming.length === 0 && past.length === 0 ? (
            <EmptyState message="Henüz randevu yok." icon="📅" />
          ) : (
            <>
              {todayAppointments.length > 0 && (
                <section style={S.section}>
                  <h3 style={S.sectionTitle}>BUGÜN</h3>
                  {todayAppointments.map(a => <AppointmentCard key={a.id} appointment={a} onEdit={openEdit} onCancel={handleCancel} onComplete={handleComplete} onDelete={handleDelete} />)}
                </section>
              )}

              {tomorrowAppointments.length > 0 && (
                <section style={S.section}>
                  <h3 style={S.sectionTitle}>YARIN</h3>
                  {tomorrowAppointments.map(a => <AppointmentCard key={a.id} appointment={a} onEdit={openEdit} onCancel={handleCancel} onComplete={handleComplete} onDelete={handleDelete} />)}
                </section>
              )}

              {weekAppointments.length > 0 && (
                <section style={S.section}>
                  <h3 style={S.sectionTitle}>7 GÜN İÇİNDE</h3>
                  {weekAppointments.map(a => <AppointmentCard key={a.id} appointment={a} onEdit={openEdit} onCancel={handleCancel} onComplete={handleComplete} onDelete={handleDelete} />)}
                </section>
              )}

              {upcoming.filter(a => !todayAppointments.includes(a) && !tomorrowAppointments.includes(a) && !weekAppointments.includes(a)).length > 0 && (
                <section style={S.section}>
                  <h3 style={S.sectionTitle}>SONRAKİ</h3>
                  {upcoming.filter(a => !todayAppointments.includes(a) && !tomorrowAppointments.includes(a) && !weekAppointments.includes(a)).map(a => <AppointmentCard key={a.id} appointment={a} onEdit={openEdit} onCancel={handleCancel} onComplete={handleComplete} onDelete={handleDelete} />)}
                </section>
              )}

              {past.length > 0 && (
                <section style={S.section}>
                  <h3 style={S.sectionTitle}>GEÇMİŞ</h3>
                  {past.map(a => <AppointmentCard key={a.id} appointment={a} onEdit={openEdit} onCancel={handleCancel} onComplete={handleComplete} onDelete={handleDelete} />)}
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

function AppointmentCard({ appointment, onEdit, onCancel, onComplete, onDelete }: {
  appointment: AppointmentRow;
  onEdit: (a: AppointmentRow) => void;
  onCancel: (a: AppointmentRow) => void;
  onComplete: (a: AppointmentRow) => void;
  onDelete: (a: AppointmentRow) => void;
}) {
  const typeLabel = APPOINTMENT_TYPES.find(t => t.value === appointment.type)?.label || appointment.type;
  const dateStr = new Date(appointment.start_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = appointment.all_day ? 'Tüm gün' : new Date(appointment.start_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <article style={S.card}>
      <div style={{ flex: 1 }}>
        <div style={S.cardHeader}>
          <span style={{ ...S.typeBadge, background: 'rgba(168,85,247,.15)', color: '#C084FC' }}>{typeLabel}</span>
          <span style={{ ...S.statusBadge, color: STATUS_COLORS[appointment.status] }}>{appointment.status === 'upcoming' ? 'Yaklaşan' : appointment.status === 'completed' ? 'Tamamlandı' : 'İptal'}</span>
        </div>
        <h4 style={S.cardTitle}>{appointment.title}</h4>
        {appointment.description && <p style={S.cardDescription}>{appointment.description}</p>}
        <div style={S.cardMeta}>
          <span>📅 {dateStr}</span>
          <span>⏰ {timeStr}</span>
        </div>
      </div>
      <div style={S.cardActions}>
        {appointment.status === 'upcoming' ? (
          <>
            <button onClick={() => onComplete(appointment)} style={S.completeButton}>✓</button>
            <button onClick={() => onEdit(appointment)} style={S.editButton}>✎</button>
            <button onClick={() => onCancel(appointment)} style={S.deleteButton}>✕</button>
          </>
        ) : (
          <button onClick={() => onDelete(appointment)} style={S.deleteButton}>🗑</button>
        )}
      </div>
    </article>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '18px 14px calc(112px + env(safe-area-inset-bottom))', maxWidth: 680, margin: '0 auto', color: '#fff' },
  kicker: { fontSize: 9, letterSpacing: 2.2, color: '#C084FC', fontWeight: 900 },
  h1: { fontSize: 29, margin: '5px 0 3px' },
  sub: { fontSize: 12, color: '#7F8499', margin: 0 },
  error: { marginTop: 14, padding: 12, borderRadius: 14, background: 'rgba(251,113,133,.1)', border: '1px solid rgba(251,113,133,.2)', color: '#FDA4AF', fontSize: 12 },
  addButton: { width: '100%', minHeight: 56, border: 0, borderRadius: 17, background: 'linear-gradient(135deg,#A855F7,#7C3AED)', color: '#fff', fontWeight: 900, fontSize: 15, marginBottom: 16, boxShadow: '0 12px 30px rgba(168,85,247,.25)' },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 13, color: '#7F8499', marginBottom: 10, fontWeight: 800 },
  formContainer: { background: 'linear-gradient(145deg,rgba(24,18,55,.94),rgba(8,10,24,.98))', border: '1px solid rgba(168,85,247,.34)', borderRadius: 28, padding: 20, boxShadow: '0 24px 70px rgba(0,0,0,.45)' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  formTitle: { fontSize: 18, margin: '0 0 10px', color: '#fff' },
  label: { fontSize: 12, color: '#A7ABC0', marginTop: 4 },
  input: { width: '100%', padding: '15px 14px', borderRadius: 15, border: '1px solid rgba(148,163,184,.16)', background: 'rgba(5,7,18,.78)', color: '#fff', fontSize: 16, minHeight: 52 },
  textarea: { width: '100%', padding: '15px 14px', borderRadius: 15, border: '1px solid rgba(148,163,184,.16)', background: 'rgba(5,7,18,.78)', color: '#fff', fontSize: 16, minHeight: 80, resize: 'vertical' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  reminderDays: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  reminderCheckbox: { fontSize: 13, color: '#A7ABC0', display: 'flex', alignItems: 'center', gap: 6 },
  buttonRow: { display: 'flex', gap: 10, marginTop: 10 },
  saveButton: { flex: 1, minHeight: 56, border: 0, borderRadius: 17, background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#04120D', fontWeight: 900, fontSize: 15 },
  cancelButton: { flex: 1, minHeight: 56, border: 0, borderRadius: 17, background: 'rgba(148,163,184,.2)', color: '#fff', fontWeight: 900, fontSize: 15 },
  card: { display: 'flex', gap: 12, alignItems: 'center', padding: 16, borderRadius: 18, background: 'linear-gradient(145deg,rgba(20,14,43,.92),rgba(7,9,21,.96))', border: '1px solid rgba(168,85,247,.15)', marginBottom: 8 },
  cardHeader: { display: 'flex', gap: 8, marginBottom: 6 },
  typeBadge: { fontSize: 10, padding: '4px 8px', borderRadius: 8, fontWeight: 800 },
  statusBadge: { fontSize: 10, padding: '4px 8px', borderRadius: 8, fontWeight: 800 },
  cardTitle: { fontSize: 15, margin: '0 0 4px', color: '#fff' },
  cardDescription: { fontSize: 12, color: '#7F8499', margin: '0 0 8px' },
  cardMeta: { display: 'flex', gap: 12, fontSize: 11, color: '#6F748A' },
  cardActions: { display: 'flex', gap: 6 },
  completeButton: { width: 36, height: 36, border: 0, borderRadius: 10, background: 'rgba(52,211,153,.15)', color: '#34D399', fontWeight: 900, fontSize: 16 },
  editButton: { width: 36, height: 36, border: 0, borderRadius: 10, background: 'rgba(168,85,247,.15)', color: '#C084FC', fontWeight: 900, fontSize: 16 },
  deleteButton: { width: 36, height: 36, border: 0, borderRadius: 10, background: 'rgba(251,113,133,.15)', color: '#F87171', fontWeight: 900, fontSize: 16 },
};
