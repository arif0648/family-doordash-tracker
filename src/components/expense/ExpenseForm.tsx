import React, { useState, FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Vehicle, ExpenseCategory } from '../../types/database';
import { playExpenseSound, speak } from '../../lib/sound';
import { toPacificDateString } from '../../lib/timezone';

interface Props {
  familyId: string;
  vehicles: Vehicle[];
  onSaved?: () => void;
}

const CATEGORY_LABELS: Record<'benzin' | 'arac_gideri' | 'market' | 'diger', string> = {
  benzin: 'Benzin',
  arac_gideri: 'Araç Gideri',
  market: 'Market',
  diger: 'Diğer',
};

export function ExpenseForm({ familyId, vehicles, onSaved }: Props) {
  const [categoryTab, setCategoryTab] = useState<'benzin' | 'arac_gideri' | 'market' | 'diger'>('benzin');
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [recordDate, setRecordDate] = useState(() => toPacificDateString(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresVehicle = categoryTab === 'benzin' || categoryTab === 'arac_gideri';
  const resolvedCategory: ExpenseCategory = categoryTab === 'diger' ? 'diger_aile' : categoryTab;


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum < 0) return setError('Tutar negatif olamaz. Geçerli bir tutar girin (örn. 12.50).');
    if (requiresVehicle && !vehicleId) return setError('Araç seçimi zorunludur.');
    

    const currentUser = (await supabase.auth.getUser()).data.user;
    if (!currentUser) return setError('Oturum bulunamadı.');
    setSaving(true);
    const { error: insertError } = await supabase.from('expenses').insert({
      family_id: familyId,
      user_id: currentUser.id,
      category: resolvedCategory,
      vehicle_id: requiresVehicle ? vehicleId : null,
      amount: amountNum,
      record_date: recordDate,
      note: null,
    });
    setSaving(false);

    if (insertError) {
      setError('Kaydedilirken bir hata oluştu: ' + insertError.message);
      return;
    }

    playExpenseSound();
    speak(`${amountNum} dolar ${CATEGORY_LABELS[categoryTab]} gideri kaydedildi.`);

    setAmount('');
    onSaved?.();
  }

  return (
    <div style={styles.form}>
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
              background: categoryTab === cat ? '#22C55E' : 'transparent',
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
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,-]/g, '').replace(',', '.'))}
      />

      <label style={styles.label}>Tarih</label>
      <input
        style={styles.input}
        type="date"
        value={recordDate}
        onChange={(e) => setRecordDate(e.target.value)}
      />

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" style={styles.saveButton} disabled={saving}>
        {saving ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display:'flex', flexDirection:'column', gap:8, padding:'12px 14px calc(110px + env(safe-area-inset-bottom))', color:'white' },
  title: { fontSize:20, fontWeight:800, margin:'6px 0', letterSpacing:-.5 },
  tabs: { display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:4, background:'rgba(20,14,43,.9)', border:'1px solid rgba(168,85,247,.2)', borderRadius:14, padding:4 },
  tab: { minHeight:42, borderRadius:10, border:'none', fontSize:11, fontWeight:800, cursor:'pointer' },
  subTabs: { display:'flex', gap:8 },
  subTab: { flex:1, minHeight:46, borderRadius:13, background:'rgba(9,10,23,.8)', color:'white', fontSize:13 },
  label: { fontSize:11, color:'#A7ABC0', marginTop:2 },
  input: { width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(148,163,184,.16)', background:'rgba(5,7,18,.78)', color:'white', fontSize:15, minHeight:46, boxSizing:'border-box' },
  error: { color:'#FB7185', fontSize:12, marginTop:4 },
  saveButton: { marginTop:8, minHeight:48, borderRadius:14, border:'none', background:'linear-gradient(135deg,#34D399,#10B981)', color:'#04120D', fontWeight:900, fontSize:14, boxShadow:'0 8px 20px rgba(16,185,129,.22)' },
};
