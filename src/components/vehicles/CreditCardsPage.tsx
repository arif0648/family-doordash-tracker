import React, { useState, useEffect, FormEvent } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen } from '../common/StateScreens';
import { supabase } from '../../lib/supabaseClient';
import { CreditCardRow } from '../../types/database';
import { computeCreditCardStatus } from '../../lib/creditCardStatus';
import { translateError } from '../../lib/errorMessage';

export function CreditCardsPage({ familyId }: { familyId: string }) {
  const { creditCards, loading, error, retry } = useFamilyRealtimeData(familyId);
  const [show, setShow] = useState(true);
  const [showPayment, setShowPayment] = useState<{ id: string; amount: number } | null>(null);

  useEffect(() => {
    if (creditCards.length > 0) setShow(false);
  }, [creditCards]);

  if (loading) return <LoadingScreen label="Kartlar yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  return (
    <main style={S.page}>
      <div style={S.header}>
        <div>
          <span style={S.kicker}>BORÇLAR</span>
          <h1 style={S.h1}>Kredi Kartları</h1>
          <p style={S.sub}>Aile hesabına bağlı kart borçları ve ödemeler.</p>
        </div>
        <button style={S.add} onClick={() => setShow(v => !v)}>
          {show ? 'Kapat' : '＋ Kart'}
        </button>
      </div>

      {show && <CardForm familyId={familyId} existingCards={creditCards} onSaved={() => { setShow(false); retry(); }} />}

      {creditCards.length > 0 ? (
        <div style={S.list}>
          {creditCards.map(c => (
            <Card
              key={c.id}
              card={c}
              onChanged={retry}
              onPayment={() => setShowPayment({ id: c.id, amount: Number(c.current_balance) })}
              onQuickPay={(amount) => setShowPayment({ id: c.id, amount })}
            />
          ))}
        </div>
      ) : (
        <p style={S.emptyTip}>İlk kredi kartını eklemek için yukarıdaki formu doldur.</p>
      )}

      {showPayment && (
        <PaymentForm
          cardId={showPayment.id}
          initialAmount={showPayment.amount}
          onClose={() => setShowPayment(null)}
          onSaved={() => { setShowPayment(null); retry(); }}
        />
      )}
    </main>
  );
}

function CardForm({ familyId, existingCards, onSaved }: { familyId: string; existingCards: CreditCardRow[]; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [due, setDue] = useState('');
  const [limit, setLimit] = useState('');
  const [minimum, setMinimum] = useState('');
  const [save, setSave] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const trimmed = name.trim();
    if (!trimmed) return setErr('Kart adı gerekli.');
    const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
    const duplicate = existingCards.find(c => c.card_name.toLowerCase().replace(/\s+/g, ' ') === normalized);
    if (duplicate && !confirm(`${trimmed} isminde bir kart zaten var. Yine de eklensin mi?`)) return;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return setErr('Oturum yok.');
    setSave(true);
    const { error } = await supabase.from('credit_cards').insert({
      family_id: familyId,
      user_id: user.id,
      card_name: trimmed,
      current_balance: Number(balance) || 0,
      due_date: due || null,
      credit_limit: limit ? Number(limit) : null,
      minimum_payment: minimum ? Number(minimum) : null,
    });
    setSave(false);
    if (error) return setErr(translateError(error.message));
    onSaved();
  }

  return (
    <form onSubmit={submit} style={S.form}>
      <input style={S.input} placeholder="Kart adı" value={name} onChange={e => setName(e.target.value)} />
      <input style={S.input} type="number" step="0.01" placeholder="Kart borcu ($)" value={balance} onChange={e => setBalance(e.target.value)} />
      <input style={S.input} type="number" step="0.01" placeholder="Kredi limiti ($)" value={limit} onChange={e => setLimit(e.target.value)} />
      <input style={S.input} type="number" step="0.01" placeholder="Asgari ödeme ($)" value={minimum} onChange={e => setMinimum(e.target.value)} />
      <label style={S.dateLabel}>Son ödeme tarihi<input style={S.input} type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
      {err && <p style={S.error}>{err}</p>}
      <button style={S.save} disabled={save}>{save ? 'Kaydediliyor…' : 'Kartı Kaydet'}</button>
    </form>
  );
}

function Card({ card, onChanged, onPayment, onQuickPay }: { card: CreditCardRow; onChanged: () => void; onPayment: () => void; onQuickPay: (amount: number) => void }) {
  const status = computeCreditCardStatus(card);
  const days = status.days;
  const urgent = days !== null && days >= 0 && days <= 7;
  const overdue = days !== null && days < 0;
  const [error, setError] = useState<string | null>(null);
  const balance = Number(card.current_balance || 0);
  const limit = Number(card.credit_limit || 0);
  const pct = limit > 0 ? Math.min((balance / limit) * 100, 100) : 0;

  async function del() {
    if (!confirm(`${card.card_name} silinsin mi?`)) return;
    const { error: delError } = await supabase.from('credit_cards').delete().eq('id', card.id);
    if (delError) {
      setError(translateError(delError.message));
      return;
    }
    onChanged();
  }

  return (
    <article style={{ ...S.card, borderColor: overdue ? 'rgba(251,113,133,.42)' : urgent ? 'rgba(244,114,182,.42)' : 'rgba(168,85,247,.18)' }}>
      <div style={S.cardTop}>
        <div>
          <span style={{ ...S.chip, color: status.accent }}>{status.label}</span>
          <h2>{card.card_name}</h2>
          {card.last_four ? <div style={S.cardNumber}>•••• {card.last_four}</div> : null}
        </div>
        <div style={S.actions}>
          <button onClick={onPayment} style={S.payBtn}>Öde</button>
          <button onClick={del} style={S.del}>Sil</button>
        </div>
      </div>
      {error && <p style={{ ...S.error, marginTop: 8 }}>{error}</p>}
      <div style={S.balance}>${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      {card.credit_limit ? (
        <>
          <div style={S.limitBarTrack}>
            <div style={{ ...S.limitBarFill, width: `${pct}%`, background: pct > 70 ? '#F43F5E' : pct > 40 ? '#F59E0B' : '#10B981' }} />
          </div>
          <div style={S.limit}>Limit: ${card.credit_limit.toLocaleString('en-US')} ({pct.toFixed(0)}%)</div>
        </>
      ) : null}
      <div style={S.quickPay}>
        {card.minimum_payment ? <button onClick={() => onQuickPay(Number(card.minimum_payment))} style={S.quickBtn}>Asgari Öde ${Number(card.minimum_payment).toFixed(0)}</button> : null}
        {balance > 0 ? <button onClick={() => onQuickPay(balance)} style={S.quickBtn}>Tamamını Öde</button> : null}
      </div>
      {card.due_date && (
        <div style={overdue ? S.dueOverdue : urgent ? S.dueUrgent : S.due}>
          <span>Son ödeme</span>
          <strong>{new Date(`${card.due_date}T12:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })}</strong>
          {overdue && <b>{Math.abs(days)} gün gecikmiş</b>}
          {urgent && !overdue && <b>{days === 0 ? 'BUGÜN' : `${days} gün kaldı`}</b>}
        </div>
      )}
    </article>
  );
}

function PaymentForm({ cardId, initialAmount, onClose, onSaved }: { cardId: string; initialAmount: number; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(initialAmount.toFixed(2));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [save, setSave] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setErr('Geçerli bir tutar girin.');
    setSave(true);
    const { error } = await supabase.rpc('record_credit_card_payment', {
      p_credit_card_id: cardId,
      p_amount: amountNum,
      p_payment_date: date,
      p_note: note || null,
    });
    setSave(false);
    if (error) return setErr(translateError(error.message));
    onSaved();
  }

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 style={S.modalTitle}>Ödeme Yap</h3>
        <form onSubmit={submit} style={S.modalForm}>
          <label style={S.label}>Ödeme Tutarı ($)</label>
          <input style={S.input} type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          <label style={S.label}>Ödeme Tarihi</label>
          <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
          <label style={S.label}>Not</label>
          <input style={S.input} value={note} onChange={e => setNote(e.target.value)} />
          {err && <p style={S.error}>{err}</p>}
          <div style={S.modalActions}>
            <button type="button" onClick={onClose} style={S.cancelBtn}>İptal</button>
            <button type="submit" style={S.submitBtn} disabled={save}>{save ? 'Kaydediliyor…' : 'Ödemeyi Kaydet'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '18px 14px calc(112px + env(safe-area-inset-bottom))', maxWidth: 680, margin: '0 auto', color: '#fff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  kicker: { fontSize: 9, letterSpacing: 2, color: '#C084FC', fontWeight: 900 },
  h1: { fontSize: 29, margin: '4px 0' },
  sub: { fontSize: 12, color: '#7F8499', margin: 0 },
  add: { border: 0, borderRadius: 14, padding: '13px 15px', background: 'linear-gradient(135deg,#A855F7,#6366F1)', color: '#fff', fontWeight: 900 },
  form: { display: 'flex', flexDirection: 'column', gap: 10, padding: 17, borderRadius: 22, background: 'rgba(18,14,42,.95)', border: '1px solid rgba(168,85,247,.25)', marginBottom: 14 },
  input: { width: '100%', minHeight: 52, padding: 14, borderRadius: 14, border: '1px solid rgba(148,163,184,.14)', background: '#080A17', color: '#fff', fontSize: 15 },
  dateLabel: { fontSize: 11, color: '#8D92A7' },
  save: { minHeight: 52, border: 0, borderRadius: 15, background: '#34D399', color: '#03130D', fontWeight: 900 },
  error: { color: '#FB7185', fontSize: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { padding: 18, borderRadius: 23, background: 'linear-gradient(145deg,rgba(21,16,48,.95),rgba(7,9,20,.98))', border: '1px solid' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  chip: { fontSize: 8, letterSpacing: 2, color: '#A78BFA' },
  cardNumber: { fontSize: 14, color: '#9CA3AF', letterSpacing: 2, marginTop: 6 },
  balance: { fontSize: 32, fontWeight: 900, letterSpacing: -1, margin: '14px 0 4px' },
  limitBarTrack: { height: 5, borderRadius: 5, background: 'rgba(255,255,255,.06)', overflow: 'hidden', marginTop: 8 },
  limitBarFill: { height: '100%', borderRadius: 5, transition: 'width .4s ease' },
  quickPay: { display: 'flex', gap: 8, marginTop: 12 },
  quickBtn: { border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '8px 12px', background: 'rgba(255,255,255,.04)', color: '#E8EAF2', fontWeight: 800, fontSize: 11 },
  limit: { fontSize: 12, color: '#7F8499', marginTop: 4 },
  due: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 13, background: 'rgba(255,255,255,.035)', color: '#8F93A8', fontSize: 11 },
  dueUrgent: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 13, background: 'rgba(244,114,182,.08)', color: '#F9A8D4', fontSize: 11 },
  dueOverdue: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 13, background: 'rgba(251,113,133,.12)', color: '#FDA4AF', fontSize: 11 },
  actions: { display: 'flex', gap: 8 },
  payBtn: { border: 0, borderRadius: 10, padding: '8px 12px', background: 'rgba(52,211,153,.15)', color: '#34D399', fontWeight: 800, fontSize: 11 },
  del: { border: 0, background: 'transparent', color: '#7F8499', fontSize: 11 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#080A17', borderRadius: 20, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 18, margin: '0 0 16px', color: '#fff' },
  modalForm: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { fontSize: 12, color: '#A7ABC0' },
  emptyTip: { textAlign: 'center', color: '#7F8499', fontSize: 13, padding: '18px 8px' },
  modalActions: { display: 'flex', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, border: '1px solid rgba(148,163,184,.2)', background: 'transparent', color: '#fff' },
  submitBtn: { flex: 1, padding: 12, borderRadius: 12, border: 0, background: '#34D399', color: '#03130D', fontWeight: 900 },
};
