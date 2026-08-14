import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { setSoundEnabled, setSpeechEnabled } from '../../lib/sound';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import { UserSettingsRow, Vehicle } from '../../types/database';

export function ProfilePage({ userId, email, familyId }: { userId: string; email: string; familyId: string }) {
  const [settings, setSettings] = useState<UserSettingsRow | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleGoals, setVehicleGoals] = useState<Record<string, string>>({});
  const [savingGoal, setSavingGoal] = useState<string | null>(null);
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
    const [settingsRes, vehiclesRes, goalRes] = await Promise.all([
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('vehicles').select('*').eq('family_id', familyId).eq('is_active', true).order('created_at'),
      supabase.from('family_member_goals').select('vehicle_id,weekly_goal').eq('family_id', familyId).not('vehicle_id', 'is', null),
    ]);

    if (settingsRes.error) {
      setError(settingsRes.error.message);
      setLoading(false);
      return;
    }

    if (vehiclesRes.error || goalRes.error) { setError(vehiclesRes.error?.message ?? goalRes.error?.message ?? 'Hedefler yüklenemedi.'); setLoading(false); return; }
    setVehicles((vehiclesRes.data ?? []) as Vehicle[]);
    const goalMap = Object.fromEntries((goalRes.data ?? []).map((g) => [g.vehicle_id, String(g.weekly_goal)]));
    setVehicleGoals(Object.fromEntries((vehiclesRes.data ?? []).map((v) => [v.id, goalMap[v.id] ?? '1400'])));

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

  async function handleSaveGoal(vehicleId: string) {
    const value = Number(vehicleGoals[vehicleId]);
    if (!value || value <= 0 || isNaN(value)) return;
    setSavingGoal(vehicleId);
    const { error: saveError } = await supabase.rpc('set_vehicle_weekly_goal', { p_family_id: familyId, p_vehicle_id: vehicleId, p_weekly_goal: value });
    if (saveError) {
      setError(saveError.message);
      setSavingGoal(null);
      return;
    }
    setSavingGoal(null);
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
    <div className="app-page" style={styles.page}>
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

      <h2 style={styles.sectionTitle}>Araç Haftalık Hedefleri</h2>
      <div style={styles.card}>
        {vehicles.map((vehicle) => <div key={vehicle.id} style={styles.goalRow}>
          <label style={styles.goalLabel}>{vehicle.short_name}</label>
          <input style={styles.goalInput} type="number" min={1} step="1" value={vehicleGoals[vehicle.id] ?? ''} onChange={(e) => setVehicleGoals((g) => ({ ...g, [vehicle.id]: e.target.value }))} />
          <button type="button" style={styles.goalSaveButton} aria-label={`${vehicle.short_name} hedefini kaydet`} disabled={savingGoal === vehicle.id} onClick={() => void handleSaveGoal(vehicle.id)}>{savingGoal === vehicle.id ? '…' : '✓'}</button>
        </div>)}
        <strong style={styles.goalTotal}>Aile hedefi: ${Object.values(vehicleGoals).reduce((sum, value) => sum + (Number(value) || 0), 0).toLocaleString('en-US')}</strong>
      </div>

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
            {showPassword ? 'Gizle' : 'Göster'}
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
          background: enabled ? 'rgba(60,200,237,.72)' : '#283444',
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
  page: { padding: '16px 14px var(--page-bottom-space)', color: 'var(--text)', maxWidth: 680, margin: '0 auto' },
  heading: { fontSize: 20, fontWeight: 750, marginBottom: 14 },
  card: { background: '#101823', border: '1px solid var(--border)', borderRadius: 18, padding: 15, marginBottom: 14, boxShadow: 'var(--shadow-card)' },
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
    background: '#090e16',
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
    background: 'rgba(67,198,232,.72)',
    color: 'white',
    fontWeight: 700,
    fontSize: 14,
  },
  goalRow: { display: 'grid', gridTemplateColumns: '1fr 110px 72px', alignItems: 'center', gap: 8, marginBottom: 8 },
  goalSaveButton: { width: 38, height: 38, justifySelf: 'end', borderRadius: 11, border: '1px solid rgba(60,200,237,.16)', background: 'rgba(60,200,237,.07)', color: 'var(--accent)', fontWeight: 800, fontSize: 15 },
  goalTotal: { display: 'block', textAlign: 'right', color: 'var(--positive)', fontSize: 13, marginTop: 8 },
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
    background: '#090e16',
    color: 'white',
    fontSize: 15,
    boxSizing: 'border-box',
  },
  toggleVisibilityButton: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,.1)',
    background: '#090e16',
    color: 'var(--text-secondary)',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  passwordError: {
    color: '#F87171',
    fontSize: 12,
    marginBottom: 10,
    margin: 0,
  },
  passwordSuccess: {
    color: 'var(--positive)',
    fontSize: 12,
    marginBottom: 10,
    margin: 0,
  },
};
