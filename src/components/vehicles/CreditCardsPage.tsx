import React, { useEffect, useState, useCallback, FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';

interface CreditCardRow {
  id: string;
  card_name: string;
  last_four: string | null;
  credit_limit: number | null;
  current_balance: number;
  due_date: string | null;
}

export function CreditCardsPage({ familyId, userId }: { familyId: string; userId: string }) {
  const [cards, setCards] = useState<CreditCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    // RLS already restricts this to the current user's own cards (Bölüm
    // credit_cards_select_own) — no explicit .eq('user_id', ...) is strictly
    // required, but we add it anyway for clarity and defense-in-depth.
    const { data, error: fetchError } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setCards(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchCards();

    const channel = supabase
      .channel(`credit-cards-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credit_cards', filter: `user_id=eq.${userId}` },
        fetchCards
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCards]);

  if (loading) return <LoadingScreen label="Kredi kartları yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={fetchCards} />;

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <h1 style={styles.heading}>Kredi Kartlarım</h1>
        <button style={styles.addButton} onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'İptal' : '+ Ekle'}
        </button>
      </div>
      <p style={styles.privacyNote}>Bu bilgiler sadece size özeldir, diğer aile üyeleri göremez.</p>

      {showForm && (
        <CreditCardForm
          familyId={familyId}
          userId={userId}
          onSaved={() => {
            setShowForm(false);
            fetchCards();
          }}
        />
      )}

      {cards.length === 0 ? (
        <EmptyState message="Henüz veri yok" icon="💳" />
      ) : (
        <div style={styles.list}>
          {cards.map((card) => (
            <CreditCardItem key={card.id} card={card} onChanged={fetchCards} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreditCardForm({
  familyId,
  userId,
  onSaved,
}: {
  familyId: string;
  userId: string;
  onSaved: () => void;
}) {
  const [cardName, setCardName] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [limit, setLimit] = useState('');
  const [balance, setBalance] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!cardName.trim()) return setError('Kart adı zorunludur.');
    if (lastFour && !/^\d{4}$/.test(lastFour)) return setError('Son 4 hane tam olarak 4 rakam olmalı.');

    setSaving(true);
    const { error: insertError } = await supabase.from('credit_cards').insert({
      family_id: familyId,
      user_id: userId,
      card_name: cardName.trim(),
      last_four: lastFour || null,
      credit_limit: limit ? parseFloat(limit) : null,
      current_balance: balance ? parseFloat(balance) : 0,
      due_date: dueDate || null,
    });
    setSaving(false);

    if (insertError) {
      setError('Kaydedilemedi: ' + insertError.message);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input style={styles.input} placeholder="Kart adı (örn. Chase Sapphire)" value={cardName} onChange={(e) => setCardName(e.target.value)} />
      <input style={styles.input} placeholder="Son 4 hane" value={lastFour} onChange={(e) => setLastFour(e.target.value)} maxLength={4} />
      <input style={styles.input} type="number" placeholder="Limit ($)" value={limit} onChange={(e) => setLimit(e.target.value)} />
      <input style={styles.input} type="number" placeholder="Güncel Bakiye ($)" value={balance} onChange={(e) => setBalance(e.target.value)} />
      <input style={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      {error && <p style={styles.error}>{error}</p>}
      <button type="submit" style={styles.saveButton} disabled={saving}>
        {saving ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  );
}

function CreditCardItem({ card, onChanged }: { card: CreditCardRow; onChanged: () => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await supabase.from('credit_cards').delete().eq('id', card.id);
    setDeleting(false);
    onChanged();
  }

  const utilization = card.credit_limit ? Math.round((card.current_balance / card.credit_limit) * 100) : null;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <p style={styles.cardName}>
          {card.card_name} {card.last_four && `•••• ${card.last_four}`}
        </p>
        <button style={styles.deleteButton} onClick={handleDelete} disabled={deleting}>
          Sil
        </button>
      </div>
      <p style={styles.cardBalance}>${card.current_balance.toLocaleString('en-US')}</p>
      {card.credit_limit && (
        <p style={styles.cardMeta}>
          Limit: ${card.credit_limit.toLocaleString('en-US')} {utilization !== null && `(%${utilization} kullanım)`}
        </p>
      )}
      {card.due_date && <p style={styles.cardMeta}>Son ödeme: {card.due_date}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '16px 16px 96px', color: 'white' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 20, fontWeight: 700, margin: 0 },
  addButton: {
    padding: '8px 16px',
    borderRadius: 10,
    border: 'none',
    background: '#22C55E',
    color: '#0B1120',
    fontWeight: 700,
    fontSize: 13,
  },
  privacyNote: { fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 16 },
  form: { display: 'flex', flexDirection: 'column', gap: 8, background: '#151B2C', borderRadius: 14, padding: 14, marginBottom: 16 },
  input: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #1E293B',
    background: '#0F172A',
    color: 'white',
    fontSize: 14,
  },
  error: { color: '#F87171', fontSize: 13 },
  saveButton: {
    padding: '12px 0',
    borderRadius: 10,
    border: 'none',
    background: '#22C55E',
    color: '#0B1120',
    fontWeight: 700,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: '#151B2C', borderRadius: 16, padding: 16 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 14, fontWeight: 600, margin: 0 },
  deleteButton: { background: 'none', border: 'none', color: '#F87171', fontSize: 12 },
  cardBalance: { fontSize: 24, fontWeight: 800, margin: '8px 0 4px' },
  cardMeta: { fontSize: 12, color: '#64748B', margin: '2px 0' },
};
