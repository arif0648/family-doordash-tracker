import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router';
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
      <div className="auth-page" style={styles.page}>
        <div className="auth-card" style={styles.card}>
          <div style={styles.success}>
            <div style={styles.check}>✓</div>
            <h2 style={{ color: 'white', fontSize: 20, margin: '0 0 8px' }}>Hesap oluşturuldu</h2>
            <p style={{ color: '#A7ABC0', fontSize: 13, lineHeight: 1.5 }}>
              E-postanızı doğruladıktan sonra giriş yapabilirsiniz. Aile verileri yönetici onayından sonra açılır.
            </p>
            <Link className="auth-primary" to="/giris" style={styles.primaryButton}>Giriş ekranına dön</Link>
            <p style={{ color: '#7F8499', fontSize: 11, marginTop: 16 }}>
              Üyelik isteğiniz BARBIN AİLESİ yöneticisine gönderildi.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={styles.page}>
      <div className="auth-card" style={styles.card}>
        <h1 style={styles.title}>HESAP OLUŞTUR</h1>
        <p style={styles.subtitle}>Aile hesabına katıl</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Adınız</label>
          <input
            className="auth-input" style={styles.input}
            type="text"
            placeholder="Ad Soyad"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
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
            placeholder="En az 6 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button className="auth-primary" style={styles.primaryButton} type="submit" disabled={loading}>
            {loading ? 'Hesap oluşturuluyor…' : 'Kayıt Ol'}
          </button>
          <Link to="/giris" style={{ ...styles.link, marginTop: 14 }}>
            Zaten hesabım var
          </Link>
        </form>
      </div>
    </div>
  );
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
    fontSize: 22,
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
    display: 'block',
    width: '100%',
    padding: '14px',
    borderRadius: 14,
    border: 'none',
    background: 'rgba(60,200,237,.1)',
    color: 'white',
    fontWeight: 900,
    fontSize: 15,
    textAlign: 'center',
    textDecoration: 'none',
    marginTop: 8,
    cursor: 'pointer',
  },
  error: { color: 'var(--negative)', fontSize: 12, textAlign: 'center', marginTop: 4 },
  link: { color: 'var(--accent)', fontSize: 12, textAlign: 'center', textDecoration: 'none', fontWeight: 700 },
  success: { textAlign: 'center' },
  check: {
    width: 56,
    height: 56,
    borderRadius: 20,
    margin: '0 auto 16px',
    display: 'grid',
    placeItems: 'center',
    fontSize: 28,
    color: 'var(--positive)',
    background: 'rgba(52,211,153,.10)',
    border: '1px solid rgba(52,211,153,.2)',
  },
};
