import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import { supabase } from '../../lib/supabaseClient';
import { IncomeRow, ExpenseRow } from '../../types/database';

interface TransactionRow {
  kind: 'income' | 'expense';
  id: string;
  date: string;
  amount: number;
  title: string;
  sub: string;
  vehicleId: string | null;
  raw: IncomeRow | ExpenseRow;
}

export function TransactionsPage({ familyId }: { familyId: string }) {
  const { income, expenses, vehicles, loading, error, retry } = useFamilyRealtimeData(familyId);
  const [note, setNote] = useState<string | null>(null);
  const navigate = useNavigate();

  if (loading) return <LoadingScreen label="İşlemler yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  const names = Object.fromEntries(vehicles.map(v => [v.id, v.short_name]));
  const rows: TransactionRow[] = [
    ...income.map(x => ({ kind: 'income' as const, id: x.id, date: x.record_date, amount: Number(x.amount), title: `${names[x.vehicle_id] ?? 'Araç'} kazancı`, sub: 'Kazanç', vehicleId: x.vehicle_id, raw: x })),
    ...expenses.map(x => ({ kind: 'expense' as const, id: x.id, date: x.record_date, amount: Number(x.amount), title: x.category, sub: x.vehicle_id ? (names[x.vehicle_id] ?? 'Araç') : 'Aile', vehicleId: x.vehicle_id, raw: x }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  async function del(row: TransactionRow) {
    if (!window.confirm('Bu kayıt silinsin mi?')) return;
    let err: Error | null = null;
    if (row.kind === 'income') {
      const { error } = await supabase.rpc('delete_income_with_mileage', { p_income_id: row.id });
      if (error) err = new Error(error.message);
    } else {
      const { error } = await supabase.from('expenses').delete().eq('id', row.id);
      if (error) err = new Error(error.message);
    }
    setNote(err ? err.message : 'Kayıt silindi.');
    if (!err) retry();
  }

  function editIncome(row: TransactionRow) {
    navigate('/kazanc/duzenle', { state: { editingIncome: row.raw as IncomeRow } });
  }

  async function editExpense(row: TransactionRow) {
    const newAmount = window.prompt('Yeni tutar ($)', String(row.amount));
    if (newAmount === null) return;
    const n = Number(newAmount);
    if (!Number.isFinite(n) || n < 0) return setNote('Geçerli bir tutar girin.');

    const { error } = await supabase.from('expenses').update({ amount: n }).eq('id', row.id);
    setNote(error ? error.message : 'Kayıt güncellendi.');
    if (!error) retry();
  }

  return (
    <main style={S.page}>
      <header>
        <span style={S.kicker}>HAREKETLER</span>
        <h1 style={S.h1}>Kazanç & Giderler</h1>
        <p style={S.sub}>Yanlış girilen tutarı düzelt veya kaydı sil.</p>
      </header>
      {note && <div style={S.note}>{note}</div>}
      {rows.length === 0 ? (
        <EmptyState message="Henüz işlem yok." icon="◌" />
      ) : (
        <div style={S.list}>
          {rows.map(r => (
            <article key={`${r.kind}-${r.id}`} style={S.row}>
              <div style={{ flex: 1 }}>
                <div style={S.rowTop}>
                  <b>{r.title}</b>
                  <span style={{ ...S.date, color: r.kind === 'income' ? '#A855F7' : '#F87171' }}>
                    {r.date}
                  </span>
                </div>
                <div style={S.rowSub}>{r.sub}</div>
              </div>
              <div style={{ ...S.amount, color: r.kind === 'income' ? '#A855F7' : '#F87171' }}>
                {r.kind === 'income' ? '+' : '-'}${r.amount.toLocaleString('en-US')}
              </div>
              <div style={S.actions}>
                <button
                  onClick={() => r.kind === 'income' ? editIncome(r) : editExpense(r)}
                  style={S.editBtn}
                >
                  Düzenle
                </button>
                <button onClick={() => del(r)} style={S.deleteBtn}>Sil</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '18px 14px calc(112px + env(safe-area-inset-bottom))', maxWidth: 680, margin: '0 auto', color: '#fff' },
  kicker: { fontSize: 9, letterSpacing: 2.2, color: '#C084FC', fontWeight: 900 },
  h1: { fontSize: 29, margin: '5px 0 3px' },
  sub: { fontSize: 12, color: '#7F8499', margin: 0 },
  note: { marginTop: 14, padding: 12, borderRadius: 14, background: 'rgba(168,85,247,.08)', border: '1px solid rgba(168,85,247,.2)', color: '#DDD6FE', fontSize: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 },
  row: { display: 'flex', gap: 10, alignItems: 'center', padding: 14, borderRadius: 18, background: 'linear-gradient(145deg,rgba(20,14,43,.92),rgba(7,9,21,.96))', border: '1px solid rgba(168,85,247,.15)' },
  rowTop: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 },
  rowSub: { fontSize: 11, color: '#7F8499', marginTop: 2 },
  date: { fontSize: 11, color: '#6F748A' },
  amount: { fontSize: 15, fontWeight: 700, minWidth: 80, textAlign: 'right' },
  actions: { display: 'flex', gap: 6 },
  editBtn: { border: 0, borderRadius: 10, padding: '9px 10px', background: 'rgba(168,85,247,.14)', color: '#D8B4FE', fontWeight: 800, fontSize: 11 },
  deleteBtn: { border: 0, borderRadius: 10, padding: '9px 10px', background: 'rgba(251,113,133,.1)', color: '#FDA4AF', fontWeight: 800, fontSize: 11 },
};