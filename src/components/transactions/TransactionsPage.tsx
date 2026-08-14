import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import { supabase } from '../../lib/supabaseClient';
import { IncomeRow, ExpenseRow } from '../../types/database';
import { translateError } from '../../lib/errorMessage';

interface TransactionRow {
  kind: 'income' | 'expense';
  id: string;
  date: string;
  amount: number;
  title: string;
  sub: string;
  vehicleId: string | null;
  category: string;
  raw: IncomeRow | ExpenseRow;
}

export function TransactionsPage({ familyId }: { familyId: string }) {
  const { income, expenses, vehicles, loading, error, retry } = useFamilyRealtimeData(familyId);
  const [note, setNote] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | 'income' | 'expense'>('all');
  const [vehicle, setVehicle] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const navigate = useNavigate();

  const safeIncome = income ?? [];
  const safeExpenses = expenses ?? [];
  const safeVehicles = vehicles ?? [];

  const rows = useMemo<TransactionRow[]>(() => {
    const names = Object.fromEntries(safeVehicles.map(v => [v.id, v.short_name]));
    const safeDate = (d: string | null | undefined) => {
      if (!d) return '9999-12-31';
      const iso = d.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '9999-12-31';
    };
    return [
      ...safeIncome.map(x => {
        const amount = Number(x.amount);
        return { kind: 'income' as const, id: x.id ?? '', date: safeDate(x.record_date), amount: Number.isFinite(amount) ? amount : 0, title: `${names[x.vehicle_id!] ?? 'Araç'} geliri`, sub: 'Gelir', vehicleId: x.vehicle_id ?? null, category: 'income', raw: x };
      }),
      ...safeExpenses.map(x => {
        const amount = Number(x.amount);
        return { kind: 'expense' as const, id: x.id ?? '', date: safeDate(x.record_date), amount: Number.isFinite(amount) ? amount : 0, title: x.category || 'Gider', sub: x.vehicle_id ? (names[x.vehicle_id!] ?? 'Araç') : 'Aile', vehicleId: x.vehicle_id ?? null, category: x.category || 'diger_aile', raw: x };
      })
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [safeIncome, safeExpenses, safeVehicles]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (kind !== 'all' && r.kind !== kind) return false;
    if (vehicle !== 'all' && r.vehicleId !== vehicle) return false;
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q) || String(r.amount).includes(q);
    }
    return true;
  }), [rows, kind, vehicle, from, to, search]);

  const total = useMemo(() => filtered.reduce((s, r) => s + (r.kind === 'income' ? r.amount : -r.amount), 0), [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, TransactionRow[]>();
    for (const r of filtered) {
      const list = map.get(r.date) || [];
      list.push(r);
      map.set(r.date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  if (loading) return <LoadingScreen label="İşlemler yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

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

  function editExpense(row: TransactionRow) {
    setEditing(row.id);
    setEditValue(String(row.amount));
  }

  async function saveExpense(row: TransactionRow) {
    const n = Number(editValue);
    if (!Number.isFinite(n) || n < 0) return setNote('Geçerli bir tutar girin.');
    if (n > 1_000_000) return setNote('Tutar çok yüksek.');
    const { error } = await supabase.from('expenses').update({ amount: n }).eq('id', row.id);
    setNote(error ? translateError(error.message) : 'Kayıt güncellendi.');
    if (!error) {
      setEditing(null);
      setEditValue('');
      retry();
    }
  }

  return (
    <main className="app-page" style={S.page}>
      <header>
        <span style={S.kicker}>HAREKETLER</span>
        <h1 style={S.h1}>Gelir & Giderler</h1>
        <p style={S.sub}>Yanlış girilen tutarı düzelt veya kaydı sil.</p>
      </header>
      {note && <div style={S.note}>{note}</div>}

      <div style={S.filters}>
        <input style={S.filterInput} placeholder="Ara…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.filterInput} value={kind} onChange={e => setKind(e.target.value as any)}>
          <option value="all">Tümü</option>
          <option value="income">Gelir</option>
          <option value="expense">Gider</option>
        </select>
        <select style={S.filterInput} value={vehicle} onChange={e => setVehicle(e.target.value)}>
          <option value="all">Tüm Araçlar</option>
          {safeVehicles.map(v => <option key={v.id} value={v.id}>{v.short_name}</option>)}
        </select>
        <div style={S.dateRow}>
          <input style={S.filterInput} type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <span style={S.dateSep}>→</span>
          <input style={S.filterInput} type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      <div style={S.summary}>Net (filtreli): <b style={{ color: total >= 0 ? '#10B981' : '#F43F5E' }}>{total >= 0 ? '+' : '−'}${Math.abs(total).toLocaleString('en-US')}</b></div>

      {grouped.length === 0 ? (
        <EmptyState message="Henüz işlem yok." icon="◌" />
      ) : (
        <div style={S.list}>
          {grouped.map(([date, items]) => (
            <React.Fragment key={date}>
              <div style={S.dateHeader}>{new Date(`${date}T00:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })}</div>
              {items.map(r => (
                <article key={`${r.kind}-${r.id}`} style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={S.rowTop}>
                      <b>{r.title}</b>
                    </div>
                    <div style={S.rowSub}>{r.sub}</div>
                  </div>
                  <div style={{ ...S.amount, color: r.kind === 'income' ? '#A855F7' : '#F43F5E' }}>
                    {r.kind === 'income' ? '+' : '−'}${r.amount.toLocaleString('en-US')}
                  </div>
                  <div style={S.actions}>
                    {editing === r.id ? (
                      <>
                        <input style={S.editInput} type="text" inputMode="decimal" value={editValue} onChange={e => setEditValue(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))} />
                        <button onClick={() => saveExpense(r)} style={S.editBtn}>Kaydet</button>
                        <button onClick={() => setEditing(null)} style={S.deleteBtn}>İptal</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => r.kind === 'income' ? editIncome(r) : editExpense(r)} style={S.editBtn}>Düzenle</button>
                        <button onClick={() => del(r)} style={S.deleteBtn}>Sil</button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '16px 14px calc(116px + var(--safe-bottom))', maxWidth: 680, margin: '0 auto', color: 'var(--text)' },
  kicker: { fontSize: 9, letterSpacing: 2.2, color: '#C084FC', fontWeight: 900 },
  h1: { fontSize: 29, margin: '5px 0 3px' },
  sub: { fontSize: 12, color: '#7F8499', margin: 0 },
  note: { marginTop: 12, padding: 11, borderRadius: 13, background: 'rgba(141,114,220,.055)', border: '1px solid rgba(141,114,220,.14)', color: 'var(--text-secondary)', fontSize: 12 },
  filters: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 },
  filterInput: { width: '100%', minHeight: 44, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: '#0c121b', color: 'var(--text)', fontSize: 13 },
  dateRow: { display: 'flex', alignItems: 'center', gap: 8 },
  dateSep: { color: '#8A90A6' },
  summary: { marginTop: 12, fontSize: 14, color: '#8A90A6' },
  list: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 },
  dateHeader: { position: 'sticky', top: 0, background: 'rgba(6,9,15,.94)', padding: '8px 4px', fontSize: 12, color: 'var(--muted)', fontWeight: 750, zIndex: 10 },
  row: { display: 'flex', gap: 10, alignItems: 'center', padding: 13, borderRadius: 16, background: '#101823', border: '1px solid var(--border)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.025)' },
  rowTop: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 },
  rowSub: { fontSize: 11, color: '#7F8499', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: 700, minWidth: 80, textAlign: 'right' },
  actions: { display: 'flex', gap: 6 },
  editInput: { width: 70, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: '#0c121b', color: 'var(--text)', fontSize: 13, textAlign: 'right' },
  editBtn: { border: 0, borderRadius: 10, padding: '9px 10px', background: 'rgba(168,85,247,.14)', color: '#D8B4FE', fontWeight: 800, fontSize: 11 },
  deleteBtn: { border: 0, borderRadius: 10, padding: '9px 10px', background: 'rgba(251,113,133,.1)', color: '#FDA4AF', fontWeight: 800, fontSize: 11 },
};
