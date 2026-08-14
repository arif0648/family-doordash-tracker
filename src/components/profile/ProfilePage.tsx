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

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validation
    if (newPassword.length < 8) {
      setPasswordError('Parola en az 8 karakter olmalı.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Parolalar eşleşmiyor.');
      return;
    }

    setChangingPassword(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        // Translate common Supabase errors to Turkish
        if (updateError.message.includes('Password should be at least')) {
          setPasswordError('Parola en az 8 karakter olmalı.');
        } else if (updateError.message.includes('Invalid login')) {
          setPasswordError('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
        } else {
          setPasswordError('Parola güncellenirken bir hata oluştu: ' + updateError.message);
        }
        return;
      }

      // Success
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);

      // Hide success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError('Beklenmeyen bir hata oluştu.');
    } finally {
      setChangingPassword(false);
    }
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

      <h2 style={styles.sectionTitle}>Parola Değiştir</h2>
      <form onSubmit={handlePasswordChange} style={styles.card}>
        <label style={styles.goalLabel}>Yeni parola</label>
        <div style={styles.passwordContainer}>
          <input
            style={styles.passwordInput}
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="En az 8 karakter"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={styles.toggleVisibilityButton}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>

        <label style={styles.goalLabel}>Yeni parola tekrar</label>
        <input
          style={styles.goalInput}
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Parolayı tekrar girin"
        />

        {passwordError && <p style={styles.passwordError}>{passwordError}</p>}
        {passwordSuccess && <p style={styles.passwordSuccess}>Parola başarıyla güncellendi!</p>}

        <button type="submit" style={styles.goalButton} disabled={changingPassword}>
          {changingPassword ? 'Güncelleniyor…' : 'Parolayı Güncelle'}
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
  passwordContainer: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,.1)',
    background: '#0B1120',
    color: 'white',
    fontSize: 15,
    boxSizing: 'border-box',
  },
  toggleVisibilityButton: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,.1)',
    background: '#0B1120',
    fontSize: 16,
    cursor: 'pointer',
  },
  passwordError: {
    color: '#F87171',
    fontSize: 12,
    marginBottom: 10,
    margin: 0,
  },
  passwordSuccess: {
    color: '#34D399',
    fontSize: 12,
    marginBottom: 10,
    margin: 0,
  },
};
