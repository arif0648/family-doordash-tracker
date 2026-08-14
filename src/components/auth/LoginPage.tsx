import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('E-posta ve şifre gereklidir.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(translateAuthError(signInError.message));
    }
    // Success: onAuthStateChange in useAuth() picks this up automatically.
  }

  return (
    <div className="auth-page" style={styles.page}>
      <div className="auth-card" style={styles.card}>
        <h1 style={styles.title}>BARBİN AİLESİ</h1>
        <p style={styles.subtitle}>Aile operasyon merkezine hoş geldiniz</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>E-posta</label>
          <input
            className="auth-input" style={styles.input}
            type="email"
            placeholder="ornek@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <label style={styles.label}>Şifre</label>
          <input
            className="auth-input" style={styles.input}
            type="password"
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button className="auth-primary" style={styles.primaryButton} type="submit" disabled={loading}>
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
          <div style={styles.links}>
            <Link to="/sifremi-unuttum" style={styles.link}>Şifremi Unuttum</Link>
            <Link to="/kayit-ol" style={styles.link}>Kayıt Ol</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-posta veya şifre hatalı.';
  if (message.includes('Email not confirmed')) return 'E-posta adresiniz henüz doğrulanmadı.';
  if (message.includes('User already registered')) return 'Bu e-posta ile zaten bir hesap var.';
  if (message.includes('Password should be at least')) return 'Şifre en az 6 karakter olmalıdır.';
  return 'Bir hata oluştu: ' + message;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 16px',
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: 26,
    borderRadius: 20,
    background: 'linear-gradient(145deg,#111925,#0a1018)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-card)',
  },
  title: {
    color: '#C4B5FD',
    fontSize: 28,
    fontWeight: 900,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    margin: '0 0 6px',
    textShadow: '0 -1px 0 #7C3AED, 0 1px 0 #5B21B6, 0 2px 0 #4C1D95, 0 3px 0 #3730A3, 0 5px 10px rgba(0,0,0,.4)',
  },
  subtitle: {
    color: '#7F8499',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 22,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 11, color: '#A7ABC0', marginTop: 4 },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,.16)',
    background: 'rgba(5,7,18,.78)',
    color: 'white',
    fontSize: 14,
    minHeight: 46,
    boxSizing: 'border-box',
  },
  primaryButton: {
    width: '100%',
    padding: '14px',
    borderRadius: 14,
    border: 'none',
    background: 'rgba(60,200,237,.1)',
    color: 'white',
    fontWeight: 900,
    fontSize: 15,
    marginTop: 8,
    cursor: 'pointer',
  },
  error: { color: '#FB7185', fontSize: 12, textAlign: 'center', marginTop: 4 },
  links: { display: 'flex', justifyContent: 'space-between', marginTop: 14 },
  link: { color: '#C084FC', fontSize: 12, textDecoration: 'none', fontWeight: 700 },
};
