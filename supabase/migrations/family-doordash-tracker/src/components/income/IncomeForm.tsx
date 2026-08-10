import React, { useState, FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Vehicle, MileageLogRow } from '../../types/database';
import { validateNewClosingMileage, MileageEntry } from '../../lib/mileageEngine';
import { playIncomeSound, speak } from '../../lib/sound';

interface Props {
  familyId: string;
  vehicles: Vehicle[];
  /** full mileage history so the form can validate the closing mileage before submit */
  mileageLog: MileageLogRow[];
  userSettings: { sound_enabled: boolean; speech_enabled: boolean } | null;
  onSaved?: () => void;
}

export function IncomeForm({ familyId, vehicles, mileageLog, userSettings, onSaved }: Props) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [closingMileage, setClosingMileage] = useState('');
  const [note, setNote] = useState('');
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  function checkMileage(value: string) {
    setWarning(null);
    const numeric = parseFloat(value);
    if (!vehicleId || isNaN(numeric)) return;
    const chain: MileageEntry[] = mileageLog
      .filter((m) => m.vehicle_id === vehicleId)
      .map((m) => ({
        id: m.id,
        vehicleId: m.vehicle_id,
        recordDate: m.record_date,
        createdAt: m.created_at,
        closingMileage: m.closing_mileage,
        milesDriven: m.miles_driven,
      }));
    const result = validateNewClosingMileage(chain, numeric);
    if (!result.valid) setWarning(result.reason);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    const mileageNum = parseFloat(closingMileage);

    if (!vehicleId) return setError('Araç seçimi zorunludur.');
    if (isNaN(amountNum) || amountNum < 0) return setError('Geçerli bir kazanç tutarı girin.');
    if (isNaN(mileageNum) || mileageNum < 0) return setError('Geçerli bir kapanış mili girin.');

    setSaving(true);
    // IMPLEMENTATION LOCK #3 — atomic RPC, income+mileage tek transaction.
    const { data, error: rpcError } = await supabase.rpc('create_income_with_mileage', {
      p_family_id: familyId,
      p_vehicle_id: vehicleId,
      p_amount: amountNum,
      p_record_date: recordDate,
      p_closing_mileage: mileageNum,
      p_note: note.trim() || null,
    });
    setSaving(false);

    if (rpcError) {
      setError(translateDbError(rpcError.message));
      return;
    }

    playIncomeSound();
    speak(`${amountNum} dolar kazanç eklendi.`, userSettings?.speech_enabled ?? false);

    setAmount('');
    setClosingMileage('');
    setNote('');
    setWarning(null);
    onSaved?.();
    void data;
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.title}>Kazanç Ekle</h2>

      <label style={styles.label}>Araç</label>
      <select style={styles.input} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.short_name}
          </option>
        ))}
      </select>

      <label style={styles.label}>Kazanç ($)</label>
      <input
        style={styles.input}
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <label style={styles.label}>Kapanış Mili</label>
      <input
        style={styles.input}
        type="number"
        min="0"
        step="0.1"
        placeholder="94150"
        value={closingMileage}
        onChange={(e) => {
          setClosingMileage(e.target.value);
          checkMileage(e.target.value);
        }}
      />
      {warning && <p style={styles.warning}>{warning}</p>}

      <label style={styles.label}>Tarih</label>
      <input
        style={styles.input}
        type="date"
        value={recordDate}
        onChange={(e) => setRecordDate(e.target.value)}
      />

      <label style={styles.label}>Not (opsiyonel)</label>
      <input style={styles.input} type="text" value={note} onChange={(e) => setNote(e.target.value)} />

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.buttonRow}>
        <button type="submit" style={styles.saveButton} disabled={saving || !!warning}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}

function translateDbError(message: string): string {
  if (message.includes('MILEAGE_LOWER_THAN_PREVIOUS')) {
    return 'Girilen kilometre, aracın önceki kaydından düşük olamaz.';
  }
  if (message.includes('AUTH_REQUIRED')) {
    return 'Oturumunuz sona ermiş görünüyor. Lütfen tekrar giriş yapın.';
  }
  return 'Kaydedilirken bir hata oluştu: ' + message;
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 8, padding: 16, color: 'white' },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  label: { fontSize: 12, color: '#94A3B8', marginTop: 8 },
  input: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #1E293B',
    background: '#151B2C',
    color: 'white',
    fontSize: 15,
  },
  warning: { color: '#FBBF24', fontSize: 13, margin: '4px 0 0' },
  error: { color: '#F87171', fontSize: 13, marginTop: 8 },
  buttonRow: { display: 'flex', gap: 10, marginTop: 16 },
  saveButton: {
    flex: 1,
    padding: '14px 0',
    borderRadius: 12,
    border: 'none',
    background: '#22C55E',
    color: '#0B1120',
    fontWeight: 700,
    fontSize: 15,
  },
};
