import React, { useState, FormEvent, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Vehicle, MileageLogRow, IncomeRow } from '../../types/database';
import { validateNewClosingMileage, MileageEntry } from '../../lib/mileageEngine';
import { playIncomeSound, speak } from '../../lib/sound';
import { toPacificDateString } from '../../lib/timezone';
import { MAX_AMOUNT } from '../../lib/format';

interface Props {
  familyId: string;
  vehicles: Vehicle[];
  mileageLog: MileageLogRow[];
  onSaved?: () => void;
  editingIncome?: IncomeRow | null;
  onCancelEdit?: () => void;
}

export function IncomeForm({ familyId, vehicles, mileageLog, onSaved, editingIncome, onCancelEdit }: Props) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [closingMileage, setClosingMileage] = useState('');
  const [recordDate, setRecordDate] = useState(() => toPacificDateString(new Date()));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Initialize form when editing
  useEffect(() => {
    if (editingIncome) {
      setVehicleId(editingIncome.vehicle_id);
      setAmount(editingIncome.amount.toString());
      setRecordDate(editingIncome.record_date);
      setNote(editingIncome.note || '');
      // Get current closing mileage from mileage log
      const currentMileage = mileageLog.find(m => m.id === editingIncome.mileage_log_id);
      if (currentMileage) {
        setClosingMileage(currentMileage.closing_mileage.toString());
      }
    }
  }, [editingIncome, mileageLog]);

  function checkMileage(value: string) {
    setWarning(null);
    const clean = value.replace(',', '.');
    const numeric = parseFloat(clean);
    if (!vehicleId) return;
    if (Number.isNaN(numeric) || value.trim() === '') {
      setWarning('Kapanış mili zorunludur. Aracın gösterge kilometresini girin.');
      return;
    }
    if (numeric < 0) {
      setWarning('Kilometre negatif olamaz.');
      return;
    }
    let chain: MileageEntry[] = mileageLog
      .filter((m) => m.vehicle_id === vehicleId)
      .map((m) => ({
        id: m.id, vehicleId: m.vehicle_id, recordDate: m.record_date, createdAt: m.created_at,
        closingMileage: m.closing_mileage, milesDriven: m.miles_driven,
      }));
    // When editing, exclude the current mileage entry so the new value is compared
    // against the surrounding chain, not against its own previous value.
    if (editingIncome?.mileage_log_id) {
      chain = chain.filter((m) => m.id !== editingIncome.mileage_log_id);
    }
    const result = validateNewClosingMileage(chain, numeric);
    if ('reason' in result) setWarning(result.reason);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const amountNum = parseFloat(amount.replace(',', '.'));
    const mileageNum = parseFloat(closingMileage.replace(',', '.'));
    if (!vehicleId) return setError('Araç seçimi zorunludur.');
    if (!Number.isFinite(amountNum) || amountNum < 0) return setError('Tutar negatif olamaz. Geçerli bir kazanç tutarı girin.');
    if (amountNum > MAX_AMOUNT) return setError(`Tutar ${MAX_AMOUNT.toLocaleString('en-US')} $ üzerinde olamaz.`);
    if (!Number.isFinite(mileageNum) || closingMileage.trim() === '' || mileageNum < 0) return setError('Kapanış mili zorunludur. Aracın gösterge kilometresini girin (örn. 94150).');
    setSaving(true);

    let rpcError;
    if (editingIncome) {
      // Edit mode - use update_income_with_mileage
      const { error } = await supabase.rpc('update_income_with_mileage', {
        p_income_id: editingIncome.id,
        p_vehicle_id: vehicleId,
        p_amount: amountNum,
        p_record_date: recordDate,
        p_closing_mileage: mileageNum,
        p_note: note || null,
      });
      rpcError = error;
    } else {
      // Create mode - use create_income_with_mileage
      const { error } = await supabase.rpc('create_income_with_mileage', {
        p_family_id: familyId, p_vehicle_id: vehicleId, p_amount: amountNum,
        p_record_date: recordDate, p_closing_mileage: mileageNum, p_note: note || null,
      });
      rpcError = error;
    }

    setSaving(false);
    if (rpcError) { setError(translateError(rpcError.message)); return; }
    playIncomeSound();
    speak(`${amountNum.toFixed(2)} dolar ${editingIncome ? 'düzenlendi' : 'eklendi'}.`);
    setAmount(''); setClosingMileage(''); setNote(''); setWarning(null);
    onSaved?.();
    if (editingIncome) onCancelEdit?.();
  }

  return (
    <div style={styles.shell}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.hero}>
          <span style={styles.eyebrow}>GELİR</span>
          <h1 style={styles.title}>{editingIncome ? 'Kazancı Düzenle' : 'Kazanç Ekle'}</h1>
          <p style={styles.subtitle}>{editingIncome ? 'Var olan kazancı güncelle.' : 'Bugünkü kazancını aile hesabına anında işle.'}</p>
        </div>
        <label style={styles.label}>Araç</label>
        <select style={styles.input} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>{vehicles.map(v => <option key={v.id} value={v.id}>{v.short_name}</option>)}</select>
        <label style={styles.label}>Kazanç ($)</label>
        <input style={styles.moneyInput} type="text" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,-]/g, '').replace(',', '.'))} />
        <label style={styles.label}>Kapanış Mili</label>
        <input style={styles.input} type="text" inputMode="decimal" placeholder="Aracın gösterge kilometresi (örn. 94150)" value={closingMileage} onChange={e => { const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'); setClosingMileage(v); checkMileage(v); }} />
        <label style={styles.label}>Tarih</label>
        <input style={styles.input} type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} />
        <label style={styles.label}>Not</label>
        <input style={styles.input} type="text" placeholder="Opsiyonel not" value={note} onChange={e => setNote(e.target.value)} />
        {warning && <p style={styles.warning}>{warning}</p>}
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.buttonRow}>
          {editingIncome && onCancelEdit && (
            <button type="button" onClick={onCancelEdit} style={styles.cancelButton} disabled={saving}>İptal</button>
          )}
          <button type="submit" style={styles.saveButton} disabled={saving || !!warning}>{saving ? 'Kaydediliyor…' : editingIncome ? 'Güncelle' : 'Kazancı Kaydet'}</button>
        </div>
      </form>
    </div>
  );
}
import { translateError } from '../../lib/errorMessage';
const styles: Record<string, React.CSSProperties> = {
  shell:{padding:'12px 14px calc(110px + env(safe-area-inset-bottom))'},
  form:{background:'linear-gradient(145deg,rgba(24,18,55,.94),rgba(8,10,24,.98))',border:'1px solid rgba(168,85,247,.34)',borderRadius:20,padding:14,boxShadow:'0 16px 40px rgba(0,0,0,.3)',display:'flex',flexDirection:'column',gap:7},
  hero:{padding:'2px 2px 4px'},
  eyebrow:{fontSize:9,letterSpacing:2,color:'#C084FC',fontWeight:800},
  title:{margin:'4px 0 3px',fontSize:20,color:'#fff',letterSpacing:-.5},
  subtitle:{margin:0,color:'#8F93A8',fontSize:11},
  label:{fontSize:11,color:'#A7ABC0',marginTop:2},
  input:{width:'100%',padding:'12px 14px',borderRadius:12,border:'1px solid rgba(148,163,184,.16)',background:'rgba(5,7,18,.78)',color:'#fff',fontSize:15,minHeight:46, boxSizing:'border-box'},
  moneyInput:{width:'100%',padding:'14px 14px',borderRadius:14,border:'1px solid rgba(52,211,153,.35)',background:'rgba(5,7,18,.82)',color:'#34D399',fontSize:18,fontWeight:800,minHeight:52, boxSizing:'border-box'},
  warning:{color:'#FBBF24',fontSize:12},
  error:{color:'#FB7185',fontSize:12},
  buttonRow:{display:'flex',gap:8,marginTop:6},
  saveButton:{flex:1,minHeight:48,border:0,borderRadius:14,background:'linear-gradient(135deg,#34D399,#10B981)',color:'#04120D',fontWeight:900,fontSize:14,boxShadow:'0 8px 20px rgba(16,185,129,.25)'},
  cancelButton:{flex:1,minHeight:48,border:0,borderRadius:14,background:'rgba(148,163,184,.2)',color:'#fff',fontWeight:900,fontSize:14}
};