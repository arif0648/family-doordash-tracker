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
    <div style={styles.container}>
      <h1 style={styles.title}>Aile DoorDash Takip</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          style={styles.input}
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.primaryButton} type="submit" disabled={loading}>
          {loading ? 'Yükleniyor…' : 'Giriş Yap'}
        </button>
        <div style={styles.links}>
          <Link to="/sifremi-unuttum" style={styles.link}>
            Şifremi Unuttum
          </Link>
          <Link to="/kayit-ol" style={styles.link}>
            Kayıt Ol
          </Link>
        </div>
      </form>
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
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: 24,
    background: '#0B1120',
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 32,
  },
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
  links: { display: 'flex', justifyContent: 'space-between', marginTop: 8 },
  link: { color: '#38BDF8', fontSize: 14, textDecoration: 'none' },
};
