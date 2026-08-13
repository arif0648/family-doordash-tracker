import React from 'react';
import { FixedExpenseRow } from '../../types/database';

function category(label: string): string {
  const map: Record<string, string> = {
    'Ev Kirası': 'Barınma',
    'Toplam Araç Kredileri': 'Araç',
    'Araç Sigortası (Toplam)': 'Sigorta',
    'Avukat Ödemesi': 'Borç/Hukuk',
    'Diğer Kredi': 'Kredi',
    'Telefon Faturası': 'Fatura',
  };
  return map[label] || 'Aile';
}

export function FixedExpensesSummary({ expenses }: { expenses: FixedExpenseRow[] }) {
  const active = expenses.filter((f) => !f.effective_to);
  const total = active.reduce((s, f) => s + Number(f.monthly_amount), 0);

  return (
    <section style={S.section}>
      <div style={S.head}>
        <div style={S.left}>
          <span style={S.icon}>🏠</span>
          <div>
            <h2 style={S.title}>Aile Sabit Giderleri (Aylık)</h2>
            <p style={S.sub}>Kira, krediler ve faturaların toplu listesi</p>
          </div>
        </div>
        <div style={S.right}>
          <span style={S.rightLabel}>Toplam Sabit:</span>
          <strong style={S.rightValue}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>
      <div style={S.list}>
        {active.map((f) => (
          <div key={f.id} style={S.row}>
            <div>
              <strong style={S.rowTitle}>{f.label}</strong>
              <p style={S.rowCat}>Kategori: {category(f.label)}</p>
            </div>
            <span style={S.rowAmount}>${Number(f.monthly_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: { padding: 16, borderRadius: 22, background: 'linear-gradient(145deg, rgba(20,25,38,.96), rgba(7,9,21,.98))', border: '1px solid rgba(255,255,255,.07)', marginBottom: 12 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  left: { display: 'flex', alignItems: 'center', gap: 10 },
  icon: { fontSize: 24 },
  title: { fontSize: 17, fontWeight: 900, margin: 0 },
  sub: { fontSize: 12, color: '#8A90A6', margin: '2px 0 0' },
  right: { textAlign: 'right' },
  rightLabel: { display: 'block', fontSize: 11, color: '#8A90A6' },
  rightValue: { fontSize: 16, color: '#F43F5E', fontWeight: 900 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 16, background: 'rgba(255,255,255,.04)' },
  rowTitle: { fontSize: 14, fontWeight: 800 },
  rowCat: { fontSize: 11, color: '#8A90A6', margin: '2px 0 0' },
  rowAmount: { fontSize: 15, color: '#F43F5E', fontWeight: 900 },
};
