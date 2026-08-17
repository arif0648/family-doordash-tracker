import React, { useState, FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Vehicle, ExpenseCategory, CreditCardRow } from '../../types/database';
import { playExpenseSound } from '../../lib/sound';
import { translateError } from '../../lib/errorMessage';
import { toPacificDateString } from '../../lib/timezone';
import { MAX_AMOUNT } from '../../lib/format';
import { NavLink } from 'react-router';

interface Props {
  familyId: string;
  vehicles: Vehicle[];
  creditCards: CreditCardRow[];
  onSaved?: () => void;
}

const CATEGORY_LABELS: Record<'benzin' | 'arac_gideri' | 'market' | 'diger', string> = {
  benzin: 'Benzin',
  arac_gideri: 'Araç Gideri',
  market: 'Market',
  diger: 'Diğer',
};

export function ExpenseForm({ familyId, vehicles, creditCards, onSaved }: Props) {
  const [categoryTab, setCategoryTab] = useState<'benzin' | 'arac_gideri' | 'market' | 'diger'>('benzin');
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [recordDate, setRecordDate] = useState(() => toPacificDateString(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<'cash_bank' | 'credit_card'>('cash_bank');
  const [creditCardId, setCreditCardId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const requiresVehicle = categoryTab === 'benzin' || categoryTab === 'arac_gideri';
  const resolvedCategory: ExpenseCategory = categoryTab === 'diger' ? 'diger_aile' : categoryTab;
  const activeCreditCards = creditCards.filter((card) => card.is_active !== false);


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return setError('Sıfırdan büyük geçerli bir tutar girin (örn. 12.50).');
    if (amountNum > MAX_AMOUNT) return setError(`Tutar ${MAX_AMOUNT.toLocaleString('en-US')} $ üzerinde olamaz.`);
    if (requiresVehicle && !vehicleId) return setError('Araç seçimi zorunludur.');
    if (paymentMethod === 'credit_card' && !creditCardId) return setError('Kredi kartı seçimi zorunludur.');
    

    const currentUser = (await supabase.auth.getUser()).data.user;
    if (!currentUser) return setError('Oturum bulunamadı.');
    setSaving(true);
    const { error: insertError } = await supabase.rpc('create_expense_with_payment', {
      p_family_id: familyId,
      p_category: resolvedCategory,
      p_vehicle_id: requiresVehicle ? vehicleId : null,
      p_amount: amountNum,
      p_record_date: recordDate,
      p_note: null,
      p_payment_method: paymentMethod,
      p_credit_card_id: paymentMethod === 'credit_card' ? creditCardId : null,
    });
    setSaving(false);

    if (insertError) {
      setError(translateError(insertError.message));
      return;
    }

    playExpenseSound();
    setAmount('');
    setSuccess('Gider başarıyla kaydedildi.');
    onSaved?.();
  }

  return (
    <div className="app-page" style={styles.form}>
      <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:10}}>
      <div><span style={{fontSize:10,letterSpacing:2,color:'#F472B6',fontWeight:900}}>GİDER</span><h2 style={styles.title}>Gider Ekle</h2><p style={{margin:0,color:'#7F8499',fontSize:12}}>Aile bütçesine anında yansır.</p></div>

      <div style={styles.tabs}>
        {(Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map((cat) => (
          <button
            type="button"
            key={cat}
            onClick={() => setCategoryTab(cat)}
            style={{
              ...styles.tab,
              background: categoryTab === cat ? 'var(--positive)' : 'transparent',
              color: categoryTab === cat ? '#0B1120' : '#94A3B8',
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {requiresVehicle && (
        <>
          <label style={styles.label}>Araç</label>
          <select style={styles.input} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.short_name}
              </option>
            ))}
          </select>
        </>
      )}

      <label style={styles.label}>Tutar ($)</label>
      <input
        style={styles.input}
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={amount}
        onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.,-]/g, '').replace(',', '.')); setError(null); setSuccess(null); }}
      />

      <label style={styles.label}>Tarih</label>
      <input
        style={styles.input}
        type="date"
        value={recordDate}
        onChange={(e) => setRecordDate(e.target.value)}
      />

      <label style={styles.label}>Ödeme Yöntemi</label>
      <select
        style={styles.input}
        value={paymentMethod}
        onChange={(e) => {
          const next = e.target.value as 'cash_bank' | 'credit_card';
          setPaymentMethod(next);
          setError(null);
          setSuccess(null);
        }}
      >
        <option value="cash_bank">Nakit / Banka</option>
        <option value="credit_card">Kredi Kartı</option>
      </select>

      {paymentMethod === 'credit_card' && (
        <>
          <label style={styles.label}>Kredi Kartı</label>
          {activeCreditCards.length > 0 ? <select
              style={styles.input}
              value={creditCardId}
              onChange={(e) => { setCreditCardId(e.target.value); setError(null); setSuccess(null); }}
            >
              <option value="">Kart seçin</option>
              {activeCreditCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.card_name}{card.last_four ? ` ••••${card.last_four}` : ''}
                </option>
              ))}
            </select> : <div style={styles.noCards}>
              <span>Henüz kredi kartı eklenmemiş.</span>
              <NavLink to="/kredi-kartlari" style={styles.addCard}>Kart Ekle</NavLink>
            </div>}
        </>
      )}

      {error && <p style={styles.error}>{error}</p>}
      {success && <p style={styles.success}>{success}</p>}

      <button type="submit" style={styles.saveButton} disabled={saving}>
        {saving ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display:'flex', flexDirection:'column', gap:9, padding:'12px 14px var(--page-bottom-space)', color:'var(--text)' },
  title: { fontSize:20, fontWeight:800, margin:'6px 0', letterSpacing:-.5 },
  tabs: { display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:4, background:'#0e151f', border:'1px solid var(--border)', borderRadius:14, padding:4 },
  tab: { minHeight:42, borderRadius:10, border:'none', fontSize:11, fontWeight:800, cursor:'pointer' },
  subTabs: { display:'flex', gap:8 },
  subTab: { flex:1, minHeight:44, borderRadius:12, background:'#0b111a', color:'var(--text)', fontSize:13 },
  label: { fontSize:11, color:'#A7ABC0', marginTop:2 },
  input: { width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid var(--border)', background:'#090e16', color:'var(--text)', fontSize:15, minHeight:46, boxSizing:'border-box' },
  error: { color:'var(--negative)', fontSize:12, marginTop:4 },
  success: { color:'var(--positive)', fontSize:12, marginTop:4 },
  noCards: { display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'11px 12px',border:'1px solid var(--border)',borderRadius:12,background:'#090e16',color:'var(--text-secondary)',fontSize:12 },
  addCard: { flexShrink:0,color:'var(--accent)',fontWeight:750,textDecoration:'none',padding:'7px 9px',border:'1px solid rgba(60,200,237,.2)',borderRadius:9 },
  saveButton: { marginTop:8, minHeight:48, borderRadius:14, border:'1px solid rgba(53,201,121,.25)', background:'rgba(53,201,121,.88)', color:'#04120D', fontWeight:800, fontSize:14 },
};
