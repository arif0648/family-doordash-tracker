import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { translateAuthError } from './LoginPage';

export function SignupPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('İsim gereklidir.');
      return;
    }
    if (!email.trim() || !password) {
      setError('E-posta ve şifre gereklidir.');
      return;
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    setLoading(false);

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.successBox}>
          <h2 style={{ color: 'white', fontSize: 20 }}>Hesap oluşturuldu</h2>
          <p style={{ color: '#94A3B8', marginTop: 8 }}>
            Devam etmek için e-postanızı doğrulamanız gerekebilir. Ardından giriş yapabilirsiniz.
          </p>
          <Link to="/giris" style={styles.link}>
            Giriş ekranına dön
          </Link>
          <p style={{ color: '#64748B', fontSize: 12, marginTop: 16 }}>
            Not: Aile üyeliğinizin (family_id) eklenmesi için hesabınız oluşturulduktan sonra bir aile
            yöneticisinin sizi aileye eklemesi gerekir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Hesap Oluştur</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          style={styles.input}
          type="text"
          placeholder="Adınız"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
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
          autoComplete="new-password"
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.primaryButton} type="submit" disabled={loading}>
          {loading ? 'Yükleniyor…' : 'Kayıt Ol'}
        </button>
        <Link to="/giris" style={styles.link}>
          Zaten hesabım var
        </Link>
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
  title: { color: 'white', fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 32 },
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
  successBox: { maxWidth: 360, margin: '0 auto', textAlign: 'center' },
};
