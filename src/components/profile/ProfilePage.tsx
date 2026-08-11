import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { requestPushPermissionAndSubscribe, disablePush } from '../../lib/push';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import { UserSettingsRow } from '../../types/database';

export function ProfilePage({ userId, email }: { userId: string; email: string }) {
  const [settings, setSettings] = useState<UserSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    if (!data) {
      // First login: create default settings row.
      const { data: created, error: createError } = await supabase
        .from('user_settings')
        .insert({ user_id: userId })
        .select()
        .single();
      if (createError) {
        setError(createError.message);
        setLoading(false);
        return;
      }
      setSettings(created);
    } else {
      setSettings(data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function toggle(field: 'sound_enabled' | 'speech_enabled') {
    if (!settings) return;
    const newValue = !settings[field];
    setSettings({ ...settings, [field]: newValue });
    await supabase.from('user_settings').update({ [field]: newValue }).eq('user_id', userId);
  }

  async function togglePush() {
    if (!settings) return;
    setPushMessage(null);
    if (settings.push_enabled) {
      await disablePush(userId);
      setSettings({ ...settings, push_enabled: false });
      return;
    }
    const result = await requestPushPermissionAndSubscribe(userId);
    if (!result.success) {
      setPushMessage(result.reason);
      return;
    }
    setSettings({ ...settings, push_enabled: true });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) return <LoadingScreen label="Profil yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={fetchSettings} />;
  if (!settings) return <ErrorScreen message="Ayarlar yüklenemedi." onRetry={fetchSettings} />;

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Profil</h1>

      <div style={styles.card}>
        <p style={styles.email}>{email}</p>
      </div>

      <h2 style={styles.sectionTitle}>Ayarlar</h2>
      <div style={styles.card}>
        <ToggleRow label="Sesler" enabled={settings.sound_enabled} onToggle={() => toggle('sound_enabled')} />
        <ToggleRow label="Konuşma" enabled={settings.speech_enabled} onToggle={() => toggle('speech_enabled')} />
        <ToggleRow label="Bildirimler" enabled={settings.push_enabled} onToggle={togglePush} />
        {pushMessage && <p style={styles.pushMessage}>{pushMessage}</p>}
      </div>

      <button style={styles.logoutButton} onClick={handleLogout}>
        Çıkış Yap
      </button>
    </div>
  );
}

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div style={styles.toggleRow}>
      <span style={styles.toggleLabel}>{label}</span>
      <button
        onClick={onToggle}
        style={{
          ...styles.toggleButton,
          background: enabled ? '#22C55E' : '#334155',
        }}
      >
        <span
          style={{
            ...styles.toggleKnob,
            transform: enabled ? 'translateX(18px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '16px 16px 96px', color: 'white' },
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  card: { background: '#151B2C', borderRadius: 16, padding: 16, marginBottom: 16 },
  email: { fontSize: 14, color: '#94A3B8', margin: 0 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#94A3B8', marginBottom: 8 },
  toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' },
  toggleLabel: { fontSize: 14 },
  toggleButton: {
    width: 44,
    height: 24,
    borderRadius: 12,
    border: 'none',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
  },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, background: 'white', transition: 'transform 0.2s' },
  pushMessage: { fontSize: 12, color: '#FBBF24', marginTop: 4 },
  logoutButton: {
    width: '100%',
    padding: '14px 0',
    borderRadius: 12,
    border: '1px solid #F87171',
    background: 'transparent',
    color: '#F87171',
    fontWeight: 600,
    fontSize: 15,
  },
};
