import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { translateAuthError } from './LoginPage';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('E-posta gereklidir.');
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/sifre-sifirla`,
    });
    setLoading(false);

    if (resetError) {
      setError(translateAuthError(resetError.message));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div style={styles.container}>
        <div style={styles.box}>
          <h2 style={{ color: 'white', fontSize: 20 }}>E-posta gönderildi</h2>
          <p style={{ color: '#94A3B8', marginTop: 8 }}>
            {email} adresine bir şifre sıfırlama bağlantısı gönderdik. Gelen kutunuzu kontrol edin.
          </p>
          <Link to="/giris" style={styles.link}>
            Giriş ekranına dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Şifremi Unuttum</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          style={styles.input}
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.primaryButton} type="submit" disabled={loading}>
          {loading ? 'Gönderiliyor…' : 'Sıfırlama Bağlantısı Gönder'}
        </button>
        <Link to="/giris" style={styles.link}>
          Giriş ekranına dön
        </Link>
      </form>
    </div>
  );
}

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    // Supabase reads the recovery token from the URL fragment automatically
    // (detectSessionInUrl: true in supabaseClient.ts) before this runs.
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate('/'), 1500);
  }

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.box}>
          <h2 style={{ color: 'white', fontSize: 20 }}>Şifreniz güncellendi</h2>
          <p style={{ color: '#94A3B8', marginTop: 8 }}>Yönlendiriliyorsunuz…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Yeni Şifre Belirle</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          style={styles.input}
          type="password"
          placeholder="Yeni Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Yeni Şifre (Tekrar)"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.primaryButton} type="submit" disabled={loading}>
          {loading ? 'Kaydediliyor…' : 'Şifreyi Güncelle'}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: 24,
    background: '#0B1120',
  },
  title: { color: 'white', fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 32 },
  form: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, width: '100%', margin: '0 auto' },
  input: {
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #1E293B',
    background: '#151B2C',
    color: 'white',
    fontSize: 16,
  },
  primaryButton: {
    padding: '14px 16px',
    borderRadius: 12,
    border: 'none',
    background: '#22C55E',
    color: 'white',
    fontWeight: 600,
    fontSize: 16,
    marginTop: 8,
  },
  error: { color: '#F87171', fontSize: 14, textAlign: 'center' },
  link: { color: '#38BDF8', fontSize: 14, textAlign: 'center', textDecoration: 'none', marginTop: 8 },
  box: { maxWidth: 360, margin: '0 auto', textAlign: 'center' },
};
