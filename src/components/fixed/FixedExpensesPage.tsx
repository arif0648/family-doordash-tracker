import React, { FormEvent, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import { toPacificDateString } from '../../lib/timezone';

export function FixedExpensesPage({ familyId }: { familyId: string }) {
  const { fixedExpenses, loading, error, retry } = useFamilyRealtimeData(familyId);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const active = useMemo(() => {
    const today = toPacificDateString(new Date());
    return fixedExpenses
      .filter((f) => f.effective_from <= today && (!f.effective_to || f.effective_to >= today))
      .filter((f) => Number(f.monthly_amount) > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [fixedExpenses]);

  const total = active.reduce((sum, item) => sum + Number(item.monthly_amount), 0);

  if (loading) return <LoadingScreen label="Sabit giderler yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  async function saveExpense(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const cleanLabel = label.trim();
    const value = Number(amount);
    if (!cleanLabel) return setMessage('Gider adı yazın.');
    if (!Number.isFinite(value) || value < 0) return setMessage('Geçerli bir aylık tutar yazın.');

    setSaving(true);
    const { error: insertError } = await supabase.rpc('set_family_fixed_expense', {
      p_family_id: familyId,
      p_label: cleanLabel,
      p_monthly_amount: value,
      p_effective_from: toPacificDateString(new Date()),
    });
    setSaving(false);

    if (insertError) {
      setMessage('Kaydedilemedi: ' + insertError.message);
      return;
    }
    setLabel('');
    setAmount('');
    setMessage('Sabit gider güncellendi.');
    retry();
  }

  async function changeAmount(item: (typeof active)[number], delta: number) {
    const current = Number(item.monthly_amount);
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    await saveVersion(item.label, next);
  }

  async function saveVersion(itemLabel: string, value: number) {
    setMessage(null);
    const { error: insertError } = await supabase.rpc('set_family_fixed_expense', {
      p_family_id: familyId,
      p_label: itemLabel,
      p_monthly_amount: value,
      p_effective_from: toPacificDateString(new Date()),
    });
    if (insertError) setMessage('Güncellenemedi: ' + insertError.message);
    else {
      setMessage('Tutar güncellendi.');
      retry();
    }
  }

  async function remove(item: (typeof active)[number]) {
    await saveVersion(item.label, 0);
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <span style={styles.eyebrow}>AYLIK BÜTÇE</span>
          <h1 style={styles.heading}>Sabit Giderler</h1>
          <p style={styles.sub}>Kira, kredi, sigorta, telefon ve diğer düzenli ödemeler.</p>
        </div>
        <strong style={styles.total}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
      </div>

      <form className="glass-form-grid" onSubmit={saveExpense} style={styles.glass}>
        <input style={styles.input} placeholder="Gider adı" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input style={styles.input} type="number" min="0" step="0.01" placeholder="Aylık tutar ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button style={styles.primary} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Sabit Gider Ekle'}</button>
      </form>

      {message && <div style={styles.message}>{message}</div>}

      {active.length === 0 ? <EmptyState message="Henüz sabit gider yok." icon="🏠" /> : (
        <div style={styles.list}>
          {active.map((item) => (
            <div key={item.id} style={styles.row}>
              <div style={{ minWidth: 0 }}>
                <strong style={styles.itemLabel}>{item.label}</strong>
                <span style={styles.itemMeta}>Aylık sabit ödeme</span>
              </div>
              <div style={styles.actions}>
                <button type="button" style={styles.small} onClick={() => changeAmount(item, -25)}>-25</button>
                <strong style={styles.amount}>${Number(item.monthly_amount).toFixed(2)}</strong>
                <button type="button" style={styles.small} onClick={() => changeAmount(item, 25)}>+25</button>
                <button type="button" style={styles.delete} onClick={() => remove(item)} aria-label={`${item.label} sil`}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={styles.note}>Değişiklikler geçmiş ayları bozmaz; bugünden itibaren geçerli yeni sürüm oluşturulur.</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '18px 16px 104px', color: '#F8FAFC', maxWidth: 720, margin: '0 auto' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, marginBottom: 16 },
  eyebrow: { color: '#A78BFA', fontSize: 10, letterSpacing: 1.5, fontWeight: 800 },
  heading: { fontSize: 26, margin: '4px 0 4px', letterSpacing: -.6 },
  sub: { color: '#94A3B8', fontSize: 12, margin: 0, lineHeight: 1.5 },
  total: { color: '#34D399', fontSize: 22, whiteSpace: 'nowrap' },
  glass: { display: 'grid', gridTemplateColumns: '1.4fr .8fr auto', gap: 8, padding: 14, borderRadius: 22, background: 'linear-gradient(145deg, rgba(168,85,247,.12), rgba(99,102,241,.06))', border: '1px solid rgba(168,85,247,.35)', boxShadow: '0 12px 30px rgba(0,0,0,.25)', marginBottom: 12 },
  input: { width: '100%', minWidth: 0, border: '1px solid rgba(168,85,247,.25)', background: 'rgba(0,0,0,.35)', color: 'white', borderRadius: 14, padding: '13px 14px', fontSize: 14, outline: 'none' },
  primary: { border: 0, borderRadius: 14, padding: '13px 18px', background: 'linear-gradient(135deg,#A855F7,#6366F1)', color: 'white', fontWeight: 900, fontSize: 13, boxShadow: '0 8px 20px rgba(99,102,241,.3)' },
  message: { color: '#C084FC', fontSize: 12, marginBottom: 8 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 14px', borderRadius: 18, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' },
  itemLabel: { display: 'block', fontSize: 15, fontWeight: 800, color: '#fff' },
  itemMeta: { display: 'block', color: '#94A3B8', fontSize: 11, marginTop: 4 },
  actions: { display: 'flex', alignItems: 'center', gap: 6 },
  small: { border: '1px solid rgba(168,85,247,.35)', background: 'rgba(168,85,247,.12)', color: '#C084FC', borderRadius: 11, padding: '7px 9px', fontSize: 11, fontWeight: 800 },
  amount: { minWidth: 72, textAlign: 'right', fontSize: 14 },
  delete: { border: 0, background: 'transparent', color: '#F87171', fontSize: 20, padding: '0 3px' },
  note: { color: '#475569', fontSize: 10, marginTop: 14, lineHeight: 1.5 },
};
