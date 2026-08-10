import React, { useState, FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Vehicle, ExpenseCategory } from '../../types/database';
import { playExpenseSound, speak } from '../../lib/sound';

interface Props {
  familyId: string;
  vehicles: Vehicle[];
  userSettings: { sound_enabled: boolean; speech_enabled: boolean } | null;
  onSaved?: () => void;
}

const CATEGORY_LABELS: Record<'benzin' | 'arac_gideri' | 'market' | 'diger', string> = {
  benzin: 'Benzin',
  arac_gideri: 'Araç Gideri',
  market: 'Market',
  diger: 'Diğer',
};

export function ExpenseForm({ familyId, vehicles, userSettings, onSaved }: Props) {
  const [categoryTab, setCategoryTab] = useState<'benzin' | 'arac_gideri' | 'market' | 'diger'>('benzin');
  const [digerScope, setDigerScope] = useState<'aile' | 'arac'>('aile');
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresVehicle =
    categoryTab === 'benzin' || categoryTab === 'arac_gideri' || (categoryTab === 'diger' && digerScope === 'arac');

  const resolvedCategory: ExpenseCategory =
    categoryTab === 'diger' ? (digerScope === 'arac' ? 'diger_arac' : 'diger_aile') : categoryTab;

  const noteRequired = categoryTab === 'diger';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 0) return setError('Geçerli bir tutar girin.');
    if (requiresVehicle && !vehicleId) return setError('Araç seçimi zorunludur.');
    if (noteRequired && !note.trim()) return setError('"Diğer" kategorisi için açıklama zorunludur.');

    setSaving(true);
    const { error: insertError } = await supabase.from('expenses').insert({
      family_id: familyId,
      category: resolvedCategory,
      vehicle_id: requiresVehicle ? vehicleId : null,
      amount: amountNum,
      record_date: recordDate,
      note: note.trim() || null,
    });
    setSaving(false);

    if (insertError) {
      setError('Kaydedilirken bir hata oluştu: ' + insertError.message);
      return;
    }

    playExpenseSound();
    speak(`${amountNum} dolar ${CATEGORY_LABELS[categoryTab]} gideri kaydedildi.`, userSettings?.speech_enabled ?? false);

    setAmount('');
    setNote('');
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.title}>Gider Ekle</h2>

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

      {categoryTab === 'diger' && (
        <div style={styles.subTabs}>
          <button
            type="button"
            onClick={() => setDigerScope('aile')}
            style={{
              ...styles.subTab,
              borderColor: digerScope === 'aile' ? '#22C55E' : '#1E293B',
            }}
          >
            Aile Geneli
          </button>
          <button
            type="button"
            onClick={() => setDigerScope('arac')}
            style={{
              ...styles.subTab,
              borderColor: digerScope === 'arac' ? '#22C55E' : '#1E293B',
            }}
          >
            Araca Özel
          </button>
        </div>
      )}

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
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <label style={styles.label}>Tarih</label>
      <input
        style={styles.input}
        type="date"
        value={recordDate}
        onChange={(e) => setRecordDate(e.target.value)}
      />

      <label style={styles.label}>
        Not {noteRequired ? '(zorunlu)' : '(opsiyonel)'}
      </label>
      <input style={styles.input} type="text" value={note} onChange={(e) => setNote(e.target.value)} />

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" style={styles.saveButton} disabled={saving}>
        {saving ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 8, padding: 16, color: 'white' },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  tabs: { display: 'flex', gap: 6, background: '#151B2C', borderRadius: 12, padding: 4 },
  tab: { flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600 },
  subTabs: { display: 'flex', gap: 8, marginTop: 8 },
  subTab: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 10,
    border: '1px solid #1E293B',
    background: 'transparent',
    color: 'white',
    fontSize: 13,
  },
  label: { fontSize: 12, color: '#94A3B8', marginTop: 8 },
  input: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #1E293B',
    background: '#151B2C',
    color: 'white',
    fontSize: 15,
  },
  error: { color: '#F87171', fontSize: 13, marginTop: 8 },
  saveButton: {
    marginTop: 16,
    padding: '14px 0',
    borderRadius: 12,
    border: 'none',
    background: '#22C55E',
    color: '#0B1120',
    fontWeight: 700,
    fontSize: 15,
  },
};
