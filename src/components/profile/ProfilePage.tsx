import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { setSoundEnabled, setSpeechEnabled } from '../../lib/sound';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import { UserSettingsRow } from '../../types/database';

export function ProfilePage({ userId, email, familyId }: { userId: string; email: string; familyId: string }) {
  const [settings, setSettings] = useState<UserSettingsRow | null>(null);
  const [goalInput, setGoalInput] = useState<string>('1400');
  const [savingGoal, setSavingGoal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [settingsRes, goalRes] = await Promise.all([
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('family_member_goals').select('weekly_goal').eq('family_id', familyId).eq('user_id', userId).maybeSingle(),
    ]);

    if (settingsRes.error) {
      setError(settingsRes.error.message);
      setLoading(false);
      return;
    }

    const g = goalRes.data ? Number(goalRes.data.weekly_goal) : null;
    setGoalInput(g != null ? String(g) : '1400');

    if (!settingsRes.data) {
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
      setSettings(settingsRes.data);
    }
    setLoading(false);
  }, [userId, familyId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setSoundEnabled(settings.sound_enabled);
      setSpeechEnabled(settings.speech_enabled);
    }
  }, [settings]);

  async function toggle(field: 'sound_enabled' | 'speech_enabled') {
    if (!settings) return;
    const newValue = !settings[field];
    setSettings({ ...settings, [field]: newValue });
    if (field === 'sound_enabled') setSoundEnabled(newValue);
    if (field === 'speech_enabled') setSpeechEnabled(newValue);
    await supabase.from('user_settings').update({ [field]: newValue }).eq('user_id', userId);
  }

  async function togglePush() {
    if (!settings) return;
    const newValue = !settings.push_enabled;
    setSettings({ ...settings, push_enabled: newValue });
    await supabase.from('user_settings').update({ push_enabled: newValue }).eq('user_id', userId);
  }

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(goalInput);
    if (!value || value <= 0 || isNaN(value)) return;
    setSavingGoal(true);
    const { error: saveError } = await supabase.rpc('set_weekly_goal', { p_family_id: familyId, p_weekly_goal: value });
    if (saveError) {
      setError(saveError.message);
      setSavingGoal(false);
      return;
    }
    setSavingGoal(false);
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
      </div>

      <h2 style={styles.sectionTitle}>Haftalık Hedefim</h2>
      <form onSubmit={handleSaveGoal} style={styles.card}>
        <label style={styles.goalLabel}>Hedef tutar (USD)</label>
        <input
          style={styles.goalInput}
          type="number"
          min={1}
          step="1"
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value)}
        />
        <button type="submit" style={styles.goalButton} disabled={savingGoal}>
          {savingGoal ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>

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
          background: enabled ? '#A855F7' : '#334155',
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
  card: { background: '#120E2A', borderRadius: 16, padding: 16, marginBottom: 16 },
  email: { fontSize: 14, color: '#A7ABC0', margin: 0 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#A7ABC0', marginBottom: 8 },
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
  goalLabel: { fontSize: 12, color: '#A7ABC0', marginBottom: 6, display: 'block' },
  goalInput: {
    width: '100%',
    padding: 10,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,.1)',
    background: '#0B1120',
    color: 'white',
    fontSize: 15,
    marginBottom: 10,
    boxSizing: 'border-box',
  },
  goalButton: {
    width: '100%',
    padding: '12px 0',
    borderRadius: 10,
    border: 'none',
    background: '#A855F7',
    color: 'white',
    fontWeight: 700,
    fontSize: 14,
  },
};
